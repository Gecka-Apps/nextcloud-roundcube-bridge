/**
 * Composable for bridging operations between Nextcloud and an embedded RoundCube iframe.
 *
 * Handles communication via postMessage to:
 * - Pick files from Nextcloud and send them to the iframe
 * - Save files from the iframe to Nextcloud
 * - Manage calendars and add events via CalDAV
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

import type { Node } from '@nextcloud/files'

import { getCurrentUser, getRequestToken } from '@nextcloud/auth'
import axios from '@nextcloud/axios'
import { getFilePickerBuilder } from '@nextcloud/dialogs'
import { translate as t } from '@nextcloud/l10n'
import { generateRemoteUrl, generateUrl } from '@nextcloud/router'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import logger from '../logger'

// Message types for iframe communication
export interface PickFileMessage {
  action: 'pickFile'
  requestId: string
  multiple?: boolean
  mimeTypes?: string[]
}

export interface SaveFileMessage {
  action: 'saveFile'
  requestId: string
  filename: string
  content: string // base64 encoded
  mimeType?: string
}

export interface SaveFilesMessage {
  action: 'saveFiles'
  requestId: string
  files: Array<{
    filename: string
    content: string // base64 encoded
    mimeType?: string
  }>
}

export interface CreateShareLinkMessage {
  action: 'createShareLink'
  requestId: string
}

export interface PickCalendarMessage {
  action: 'pickCalendar'
  requestId: string
  icsContent: string
}

export interface ParsedEventDate {
  date: string
  allDay: boolean
}

export interface ParsedCalendarUser {
  name: string
  email: string
  status?: string
}

export interface ParsedEvent {
  summary: string
  description: string
  location: string
  status: string
  start: ParsedEventDate | null
  end: ParsedEventDate | null
  organizer: ParsedCalendarUser | null
  attendees: ParsedCalendarUser[]
}

export interface FilePickedResponse {
  action: 'filePicked'
  requestId: string
  success: boolean
  files?: Array<{
    name: string
    path: string
    mimeType: string
    size: number
    content: string // base64 encoded
  }>
  error?: string
}

export interface FileSavedResponse {
  action: 'fileSaved'
  requestId: string
  success: boolean
  path?: string
  error?: string
}

export interface ShareLinkCreatedResponse {
  action: 'shareLinkCreated'
  requestId: string
  success: boolean
  url?: string
  filename?: string
  password?: string
  expireDate?: string
  label?: string
  note?: string
  error?: string
}

export interface CalendarInfo {
  url: string
  displayname: string
  color: string
}

export interface CalendarPickedResponse {
  action: 'calendarPicked'
  requestId: string
  success: boolean
  updated?: boolean // true if event was updated, false if created
  error?: string
}

type IframeMessage = PickFileMessage | SaveFileMessage | SaveFilesMessage | CreateShareLinkMessage | PickCalendarMessage

// Pending request state
interface PendingPickRequest {
  requestId: string
  multiple: boolean
  mimeTypes?: string[]
}

interface PendingSaveRequest {
  requestId: string
  filename: string
  content: string
  mimeType?: string
}

interface PendingSaveFilesRequest {
  requestId: string
  files: Array<{
    filename: string
    content: string
    mimeType?: string
  }>
}

interface PendingShareLinkRequest {
  requestId: string
}

/**
 * Composable to bridge file operations between Nextcloud and an iframe.
 *
 * @param iframeRef - Ref to the iframe element
 * @param iframeRef.value - The current iframe element, or null until it mounts
 * @param options - Options object
 * @param options.allowedOrigin - Origin to accept messages from (optional, defaults to same origin)
 * @param options.enabled - Whether the bridge is enabled (optional, defaults to true)
 */
export function useIframeBridge(
  iframeRef: { value: HTMLIFrameElement | null },
  options?: { allowedOrigin?: string, enabled?: boolean },
) {
  const isProcessing = ref(false)
  const enabled = options?.enabled ?? true
  const allowedOrigin = options?.allowedOrigin
  const currentUser = getCurrentUser()

  // File picker state (for Vue component control)
  const isFilePickerOpen = ref(false)
  const isFileSaverOpen = ref(false)
  const isShareLinkPickerOpen = ref(false)
  const pendingPickRequest = ref<PendingPickRequest | null>(null)
  const pendingSaveRequest = ref<PendingSaveRequest | null>(null)
  const pendingSaveFilesRequest = ref<PendingSaveFilesRequest | null>(null)
  const pendingShareLinkRequest = ref<PendingShareLinkRequest | null>(null)

  // Share options form state
  const isShareOptionsOpen = ref(false)
  const pendingShareWithOptionsRequest = ref<{
    requestId: string
    path: string
    filename: string
  } | null>(null)
  const shareServerError = ref('')
  const shareServerErrorDetail = ref('')

  // Calendar picker state
  const isCalendarPickerOpen = ref(false)
  const pendingCalendarRequest = ref<{ requestId: string, icsContent: string } | null>(null)
  const calendarEvent = ref<ParsedEvent | null>(null)
  const calendarList = ref<CalendarInfo[]>([])
  const calendarError = ref('')

  /**
   * Get the WebDAV base URL for the current user.
   *
   * @param path - Path within the user's files, relative to the WebDAV root
   */
  const getWebDavUrl = (path: string = ''): string => {
    if (!currentUser?.uid) {
      throw new Error('No user logged in')
    }
    // generateRemoteUrl expects path without leading slash
    const basePath = `dav/files/${currentUser.uid}`
    const cleanPath = path.startsWith('/') ? path : `/${path}`
    return generateRemoteUrl(basePath + cleanPath)
  }

  /**
   * Download a file from Nextcloud via WebDAV.
   *
   * @param path - Path of the file to download, relative to the user's files root
   */
  const downloadFile = async (path: string): Promise<{ content: ArrayBuffer, mimeType: string }> => {
    const url = getWebDavUrl(path)
    logger.debug('Downloading file from WebDAV', { url, path })

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`)
    }

    const content = await response.arrayBuffer()
    const mimeType = response.headers.get('Content-Type') || 'application/octet-stream'

    return { content, mimeType }
  }

  /**
   * Check if a file exists via WebDAV.
   *
   * @param path - Path to check, relative to the user's files root
   */
  const fileExists = async (path: string): Promise<boolean> => {
    const url = getWebDavUrl(path)
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        credentials: 'include',
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Find a unique filename by adding (2), (3), etc. if the file already exists.
   * Mimics the behavior of Nextcloud Mail app.
   *
   * @param folderPath - Folder the file will be written into
   * @param filename - Desired file name before deduplication
   */
  const findUniqueFilename = async (folderPath: string, filename: string): Promise<string> => {
    // Split filename into name and extension
    const lastDot = filename.lastIndexOf('.')
    const hasExtension = lastDot > 0
    const baseName = hasExtension ? filename.substring(0, lastDot) : filename
    const extension = hasExtension ? filename.substring(lastDot) : ''

    // Try the original filename first
    let fullPath = `${folderPath}/${filename}`.replace(/\/+/g, '/')
    if (!(await fileExists(fullPath))) {
      return fullPath
    }

    // File exists, try with counter
    let counter = 2
    while (counter <= 100) { // Safety limit
      const newFilename = `${baseName} (${counter})${extension}`
      fullPath = `${folderPath}/${newFilename}`.replace(/\/+/g, '/')
      if (!(await fileExists(fullPath))) {
        return fullPath
      }
      counter++
    }

    // Fallback: use timestamp
    const timestamp = Date.now()
    const newFilename = `${baseName} (${timestamp})${extension}`
    return `${folderPath}/${newFilename}`.replace(/\/+/g, '/')
  }

  /**
   * Upload a file to Nextcloud via WebDAV.
   *
   * @param path - Destination path, relative to the user's files root
   * @param content - File contents to upload
   * @param mimeType - MIME type to store the file as
   */
  const uploadFile = async (path: string, content: ArrayBuffer, mimeType?: string): Promise<void> => {
    const url = getWebDavUrl(path)
    logger.debug('Uploading file to WebDAV', { url, path })

    const requestToken = getRequestToken()
    const headers: Record<string, string> = {
      'Content-Type': mimeType || 'application/octet-stream',
    }
    if (requestToken) {
      headers.requesttoken = requestToken
    }

    const response = await fetch(url, {
      method: 'PUT',
      credentials: 'include',
      headers,
      body: content,
    })

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.status} ${response.statusText}`)
    }
  }

  /**
   * Get the CalDAV base URL for the current user's calendars.
   *
   * @param path - Calendar path appended to the user's CalDAV root
   */
  const getCalDavUrl = (path: string = ''): string => {
    if (!currentUser?.uid) {
      throw new Error('No user logged in')
    }
    const basePath = `dav/calendars/${currentUser.uid}`
    const cleanPath = path.startsWith('/') ? path : path ? `/${path}` : ''
    return generateRemoteUrl(basePath + cleanPath)
  }

  /**
   * Fetch user's calendars via CalDAV PROPFIND.
   */
  const fetchCalendars = async (): Promise<CalendarInfo[]> => {
    const url = getCalDavUrl()
    logger.debug('Fetching calendars from CalDAV', { url })

    const requestToken = getRequestToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/xml; charset=utf-8',
      Depth: '1',
    }
    if (requestToken) {
      headers.requesttoken = requestToken
    }

    const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:oc="http://owncloud.org/ns" xmlns:nc="http://nextcloud.org/ns" xmlns:x1="http://apple.com/ns/ical/">
  <d:prop>
    <d:resourcetype/>
    <d:displayname/>
    <x1:calendar-color/>
    <cs:getctag/>
    <c:supported-calendar-component-set/>
    <oc:calendar-enabled/>
    <d:current-user-privilege-set/>
  </d:prop>
</d:propfind>`

    const response = await fetch(url, {
      method: 'PROPFIND',
      credentials: 'include',
      headers,
      body: propfindBody,
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch calendars: ${response.status} ${response.statusText}`)
    }

    const text = await response.text()
    const calendars: CalendarInfo[] = []

    // Parse XML response
    const parser = new DOMParser()
    const doc = parser.parseFromString(text, 'application/xml')
    const responses = doc.getElementsByTagNameNS('DAV:', 'response')

    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i]

      // Check if it's a calendar (has calendar resource type)
      const resourceTypes = resp.getElementsByTagNameNS('DAV:', 'resourcetype')[0]
      if (!resourceTypes) {
        continue
      }

      const isCalendar = resourceTypes.getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'calendar').length > 0
      if (!isCalendar) {
        continue
      }

      // Check if calendar supports VEVENT
      const supportedComponents = resp.getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'supported-calendar-component-set')[0]
      let supportsVevent = false
      if (supportedComponents) {
        const comps = supportedComponents.getElementsByTagNameNS('urn:ietf:params:xml:ns:caldav', 'comp')
        for (let j = 0; j < comps.length; j++) {
          if (comps[j].getAttribute('name') === 'VEVENT') {
            supportsVevent = true
            break
          }
        }
      }
      if (!supportsVevent) {
        continue
      }

      // Check if calendar is enabled
      const enabledEl = resp.getElementsByTagNameNS('http://owncloud.org/ns', 'calendar-enabled')[0]
      if (enabledEl && enabledEl.textContent === '0') {
        continue
      }

      // Skip read-only calendars (e.g. the generated contact birthdays calendar,
      // calendars shared without write access): the user must be able to write.
      const privilegeSet = resp.getElementsByTagNameNS('DAV:', 'current-user-privilege-set')[0]
      const canWrite = privilegeSet !== undefined
        && (privilegeSet.getElementsByTagNameNS('DAV:', 'write').length > 0
          || privilegeSet.getElementsByTagNameNS('DAV:', 'write-content').length > 0)
      if (!canWrite) {
        continue
      }

      // Get calendar URL
      const hrefEl = resp.getElementsByTagNameNS('DAV:', 'href')[0]
      if (!hrefEl) {
        continue
      }
      const href = hrefEl.textContent || ''

      // Get display name
      const displaynameEl = resp.getElementsByTagNameNS('DAV:', 'displayname')[0]
      const displayname = displaynameEl?.textContent || 'Calendar'

      // Get calendar color
      const colorEl = resp.getElementsByTagNameNS('http://apple.com/ns/ical/', 'calendar-color')[0]
      let color = colorEl?.textContent || '#0082c9'
      // Normalize color (remove alpha if present: #RRGGBBAA -> #RRGGBB)
      if (color.length === 9 && color.startsWith('#')) {
        color = color.substring(0, 7)
      }

      calendars.push({ url: href, displayname, color })
    }

    return calendars
  }

  /**
   * Add an event to a calendar via the bridge API.
   * The API handles orphaned UIDs from soft-deleted events.
   *
   * @param calendarUrl - The calendar URL (e.g., /remote.php/dav/calendars/user/personal/)
   * @param icsContent - The ICS content of the event
   * @return Object with updated: true if event was updated, false if created
   */
  const addEventToCalendar = async (calendarUrl: string, icsContent: string): Promise<{ updated: boolean }> => {
    logger.debug('Adding event to calendar via API', { calendarUrl })

    const response = await axios.post(
      generateUrl('/apps/mail_roundcube_bridge/api/calendar/event'),
      {
        calendarUri: calendarUrl,
        icsContent,
      },
    )

    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to add event')
    }

    logger.debug('Event added successfully', { updated: response.data.updated, uid: response.data.uid })
    return { updated: response.data.updated }
  }

  /**
   * Parse ICS content into a structured event for preview.
   * Parsing happens server-side so the preview reflects the exact bytes
   * Nextcloud would import.
   *
   * @param icsContent - The ICS content of the event
   */
  const parseEvent = async (icsContent: string): Promise<ParsedEvent> => {
    const response = await axios.post(
      generateUrl('/apps/mail_roundcube_bridge/api/calendar/parse'),
      { icsContent },
    )
    return response.data
  }

  /**
   * Convert ArrayBuffer to base64 string.
   *
   * @param buffer - Binary data to encode
   */
  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Convert base64 string to ArrayBuffer.
   *
   * @param base64 - Base64 string to decode
   */
  const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Send a message to the iframe.
   *
   * @param message - Response to post back into the iframe
   */
  const sendToIframe = (message: FilePickedResponse | FileSavedResponse | ShareLinkCreatedResponse | CalendarPickedResponse): void => {
    const iframe = iframeRef.value
    if (!iframe?.contentWindow) {
      logger.error('Cannot send message: iframe not available')
      return
    }
    const targetOrigin = allowedOrigin || window.location.origin
    iframe.contentWindow.postMessage(message, targetOrigin)
    logger.debug('Message sent to iframe', { message, targetOrigin })
  }

  /**
   * Callback when files are picked from the FilePicker component.
   *
   * @param nodes - Files selected in the picker
   */
  const onFilesPicked = async (nodes: Node[]): Promise<void> => {
    const request = pendingPickRequest.value
    if (!request) {
      logger.error('No pending pick request')
      return
    }

    // Clear pending request immediately to prevent onFilePickerClose from sending "Cancelled"
    pendingPickRequest.value = null

    try {
      const files: FilePickedResponse['files'] = []

      for (const node of nodes) {
        try {
          const path = node.path || ''
          const { content, mimeType } = await downloadFile(path)
          const name = node.basename || path.split('/').pop() || 'file'

          files.push({
            name,
            path,
            mimeType,
            size: content.byteLength,
            content: arrayBufferToBase64(content),
          })
        } catch (error) {
          logger.error('Failed to download file', { path: node.path, error })
        }
      }

      sendToIframe({
        action: 'filePicked',
        requestId: request.requestId,
        success: files.length > 0,
        files,
      })
    } catch (error) {
      logger.error('File picker error', { error })
      sendToIframe({
        action: 'filePicked',
        requestId: request.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      isProcessing.value = false
      isFilePickerOpen.value = false
    }
  }

  /**
   * Callback when the file picker is closed without selection.
   */
  const onFilePickerClose = (): void => {
    const request = pendingPickRequest.value
    // Only send "Cancelled" if there's still a pending request
    // (onFilesPicked clears it when user clicks the button)
    if (request) {
      sendToIframe({
        action: 'filePicked',
        requestId: request.requestId,
        success: false,
        error: 'Cancelled',
      })
      pendingPickRequest.value = null
    }
    isProcessing.value = false
    isFilePickerOpen.value = false
  }

  /**
   * Handle file pick request from iframe - opens the picker.
   *
   * @param message - The pickFile request from the iframe
   */
  const handlePickFile = (message: PickFileMessage): void => {
    logger.info('Handling pickFile request', { message })
    isProcessing.value = true
    pendingPickRequest.value = {
      requestId: message.requestId,
      multiple: message.multiple ?? true,
      mimeTypes: message.mimeTypes,
    }

    const builder = getFilePickerBuilder(t('mail_roundcube_bridge', 'Choose a file to add as attachment'))
      .setMultiSelect(message.multiple ?? true)
      .addButton({
        label: t('mail_roundcube_bridge', 'Choose'),
        type: 'primary',
        callback: (nodes) => onFilesPicked(nodes as Node[]),
      })
    if (message.mimeTypes?.length) {
      builder.setMimeTypeFilter(message.mimeTypes)
    }
    builder.build().pick().catch(() => onFilePickerClose())
  }

  /**
   * Callback when a folder is selected for saving.
   *
   * @param nodes - Folder selected in the picker (the first entry is used)
   */
  const onFolderSelected = async (nodes: Node[]): Promise<void> => {
    const singleRequest = pendingSaveRequest.value
    const multiRequest = pendingSaveFilesRequest.value

    if (!singleRequest && !multiRequest) {
      logger.error('No pending save request')
      return
    }

    // Clear pending requests immediately to prevent onFileSaverClose from sending "Cancelled"
    pendingSaveRequest.value = null
    pendingSaveFilesRequest.value = null

    const folderPath = nodes[0]?.path || '/'

    // Handle multiple files save
    if (multiRequest) {
      const savedPaths: string[] = []
      const errors: string[] = []

      for (const file of multiRequest.files) {
        try {
          const destinationPath = await findUniqueFilename(folderPath, file.filename)
          logger.debug('Saving file to', { destinationPath })
          const content = base64ToArrayBuffer(file.content)
          await uploadFile(destinationPath, content, file.mimeType)
          savedPaths.push(destinationPath)
        } catch (error) {
          logger.error('File save error', { filename: file.filename, error })
          errors.push(file.filename)
        }
      }

      sendToIframe({
        action: 'fileSaved',
        requestId: multiRequest.requestId,
        success: savedPaths.length > 0,
        path: savedPaths.join(', '),
        error: errors.length > 0 ? `Failed: ${errors.join(', ')}` : undefined,
      })

      isProcessing.value = false
      isFileSaverOpen.value = false
      return
    }

    // Handle single file save
    if (singleRequest) {
      try {
        const destinationPath = await findUniqueFilename(folderPath, singleRequest.filename)
        logger.debug('Saving file to', { destinationPath })
        const content = base64ToArrayBuffer(singleRequest.content)
        await uploadFile(destinationPath, content, singleRequest.mimeType)

        sendToIframe({
          action: 'fileSaved',
          requestId: singleRequest.requestId,
          success: true,
          path: destinationPath,
        })
      } catch (error) {
        logger.error('File save error', { error })
        sendToIframe({
          action: 'fileSaved',
          requestId: singleRequest.requestId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        isProcessing.value = false
        isFileSaverOpen.value = false
      }
    }
  }

  /**
   * Callback when the folder picker is closed without selection.
   */
  const onFileSaverClose = (): void => {
    const singleRequest = pendingSaveRequest.value
    const multiRequest = pendingSaveFilesRequest.value

    // Only send "Cancelled" if there's still a pending request
    // (onFolderSelected clears it when user clicks the button)
    if (singleRequest) {
      sendToIframe({
        action: 'fileSaved',
        requestId: singleRequest.requestId,
        success: false,
        error: 'Cancelled',
      })
      pendingSaveRequest.value = null
    }
    if (multiRequest) {
      sendToIframe({
        action: 'fileSaved',
        requestId: multiRequest.requestId,
        success: false,
        error: 'Cancelled',
      })
      pendingSaveFilesRequest.value = null
    }
    isProcessing.value = false
    isFileSaverOpen.value = false
  }

  /**
   * Open the Nextcloud folder picker for saving attachments.
   */
  const openFolderPicker = (): void => {
    getFilePickerBuilder(t('mail_roundcube_bridge', 'Choose a folder to store the attachment in'))
      .setMultiSelect(false)
      .setMimeTypeFilter(['httpd/unix-directory'])
      .allowDirectories(true)
      .addButton({
        label: t('mail_roundcube_bridge', 'Choose'),
        type: 'primary',
        callback: (nodes) => onFolderSelected(nodes as Node[]),
      })
      .build()
      .pick()
      .catch(() => onFileSaverClose())
  }

  /**
   * Handle file save request from iframe - opens the folder picker.
   *
   * @param message - The saveFile request from the iframe
   */
  const handleSaveFile = (message: SaveFileMessage): void => {
    logger.info('Handling saveFile request', { filename: message.filename })
    isProcessing.value = true
    pendingSaveRequest.value = {
      requestId: message.requestId,
      filename: message.filename,
      content: message.content,
      mimeType: message.mimeType,
    }
    pendingSaveFilesRequest.value = null
    openFolderPicker()
  }

  /**
   * Handle multiple files save request from iframe - opens the folder picker once.
   *
   * @param message - The saveFiles request from the iframe
   */
  const handleSaveFiles = (message: SaveFilesMessage): void => {
    logger.info('Handling saveFiles request', { count: message.files.length })
    isProcessing.value = true
    pendingSaveFilesRequest.value = {
      requestId: message.requestId,
      files: message.files,
    }
    pendingSaveRequest.value = null
    openFolderPicker()
  }

  /**
   * Callback when a file is picked for share link creation.
   * Opens the share options form instead of creating the share immediately.
   *
   * @param nodes - File selected to share (the first entry is used)
   */
  const onShareLinkFilePicked = async (nodes: Node[]): Promise<void> => {
    const request = pendingShareLinkRequest.value
    if (!request) {
      logger.error('No pending share link request')
      return
    }

    const node = nodes[0]
    if (!node?.path) {
      pendingShareLinkRequest.value = null
      sendToIframe({
        action: 'shareLinkCreated',
        requestId: request.requestId,
        success: false,
        error: 'No file selected',
      })
      isProcessing.value = false
      isShareLinkPickerOpen.value = false
      return
    }

    const filename = node.basename || node.path.split('/').pop() || 'file'

    // Store file info, close picker, then open share options form on next tick
    // to avoid DOM conflicts between FilePicker unmount and ShareOptionsForm mount
    pendingShareWithOptionsRequest.value = {
      requestId: request.requestId,
      path: node.path,
      filename,
    }
    pendingShareLinkRequest.value = null
    isShareLinkPickerOpen.value = false
    shareServerError.value = ''
    shareServerErrorDetail.value = ''
    await nextTick()
    isShareOptionsOpen.value = true
  }

  /**
   * Callback when the share link file picker is closed.
   * Uses setTimeout to let the button callback run first when a file is selected,
   * since the FilePicker emits 'close' before calling the button callback.
   */
  const onShareLinkPickerClose = (): void => {
    isShareLinkPickerOpen.value = false
    setTimeout(() => {
      const request = pendingShareLinkRequest.value
      if (request) {
        sendToIframe({
          action: 'shareLinkCreated',
          requestId: request.requestId,
          success: false,
          error: 'Cancelled',
        })
        pendingShareLinkRequest.value = null
        isProcessing.value = false
      }
    }, 0)
  }

  /**
   * Handle create share link request from iframe - opens file picker.
   *
   * @param message - The createShareLink request from the iframe
   */
  const handleCreateShareLink = (message: CreateShareLinkMessage): void => {
    logger.info('Handling createShareLink request')
    isProcessing.value = true
    pendingShareLinkRequest.value = {
      requestId: message.requestId,
    }
    getFilePickerBuilder(t('mail_roundcube_bridge', 'Choose a file to share as a link'))
      .setMultiSelect(false)
      .addButton({
        label: t('mail_roundcube_bridge', 'Share'),
        type: 'primary',
        callback: (nodes) => onShareLinkFilePicked(nodes as Node[]),
      })
      .build()
      .pick()
      .catch(() => onShareLinkPickerClose())
  }

  /**
   * Callback when share options form is submitted.
   * Creates the share link via the bridge API with all options.
   *
   * @param options - Share settings entered in the form
   * @param options.path - Path of the file to share
   * @param options.password - Optional password protecting the link
   * @param options.expireDate - Optional expiration date (YYYY-MM-DD)
   * @param options.label - Optional label for the share
   * @param options.note - Optional note shown to the recipient
   * @param options.hideDownload - Whether to hide the download button
   * @param options.permissions - Permissions bitfield for the share
   * @param options.sendPasswordByTalk - Whether to send the password over Talk
   */
  const onShareOptionsSubmit = async (options: {
    path: string
    password: string
    expireDate: string
    label: string
    note: string
    hideDownload: boolean
    permissions: number
    sendPasswordByTalk: boolean
  }): Promise<void> => {
    const request = pendingShareWithOptionsRequest.value
    if (!request) {
      logger.error('No pending share request for options submit')
      return
    }

    try {
      const payload: Record<string, unknown> = { path: options.path }
      if (options.password) {
        payload.password = options.password
      }
      if (options.expireDate) {
        payload.expireDate = options.expireDate
      }
      if (options.label) {
        payload.label = options.label
      }
      if (options.note) {
        payload.note = options.note
      }
      if (options.hideDownload) {
        payload.hideDownload = true
      }
      if (options.permissions && options.permissions !== 1) {
        payload.permissions = options.permissions
      }
      if (options.sendPasswordByTalk) {
        payload.sendPasswordByTalk = true
      }

      const response = await axios.post(
        generateUrl('/apps/mail_roundcube_bridge/api/share'),
        payload,
      )

      const responseData = response.data
      const shareResponse: ShareLinkCreatedResponse = {
        action: 'shareLinkCreated',
        requestId: request.requestId,
        success: true,
        url: responseData.url,
        filename: request.filename,
      }
      if (responseData.password) {
        shareResponse.password = responseData.password
      }
      if (responseData.expireDate) {
        shareResponse.expireDate = responseData.expireDate
      }
      if (responseData.label) {
        shareResponse.label = responseData.label
      }
      if (responseData.note) {
        shareResponse.note = responseData.note
      }
      sendToIframe(shareResponse)

      pendingShareWithOptionsRequest.value = null
      isShareOptionsOpen.value = false
      isProcessing.value = false
    } catch (error: unknown) {
      logger.error('Failed to create share link', { error })
      const axiosError = error as { response?: { data?: { error?: string, detail?: string } } }
      shareServerError.value = axiosError.response?.data?.error || 'Failed to create share link'
      shareServerErrorDetail.value = axiosError.response?.data?.detail || ''
    }
  }

  /**
   * Callback when share options form is cancelled.
   */
  const onShareOptionsCancel = (): void => {
    const request = pendingShareWithOptionsRequest.value
    if (request) {
      sendToIframe({
        action: 'shareLinkCreated',
        requestId: request.requestId,
        success: false,
        error: 'Cancelled',
      })
      pendingShareWithOptionsRequest.value = null
    }
    isShareOptionsOpen.value = false
    isProcessing.value = false
  }

  /**
   * Handle pick calendar request from iframe.
   * Parses the event and loads the calendars, then opens the picker so the
   * user confirms against a Nextcloud-rendered preview.
   *
   * @param message - The pickCalendar request from the iframe
   */
  const handlePickCalendar = async (message: PickCalendarMessage): Promise<void> => {
    logger.info('Handling pickCalendar request')
    isProcessing.value = true
    pendingCalendarRequest.value = {
      requestId: message.requestId,
      icsContent: message.icsContent,
    }
    calendarError.value = ''

    try {
      const [event, calendars] = await Promise.all([
        parseEvent(message.icsContent),
        fetchCalendars(),
      ])

      if (!calendars.length) {
        sendToIframe({
          action: 'calendarPicked',
          requestId: message.requestId,
          success: false,
          error: 'No calendars available',
        })
        pendingCalendarRequest.value = null
        isProcessing.value = false
        return
      }

      calendarEvent.value = event
      calendarList.value = calendars
      isCalendarPickerOpen.value = true
    } catch (error) {
      logger.error('Failed to prepare calendar picker', { error })
      sendToIframe({
        action: 'calendarPicked',
        requestId: message.requestId,
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read event',
      })
      pendingCalendarRequest.value = null
      isProcessing.value = false
    }
  }

  /**
   * Callback when the user confirms a calendar in the picker.
   *
   * @param calendarUrl - URL of the calendar chosen by the user
   */
  const onCalendarSubmit = async (calendarUrl: string): Promise<void> => {
    const request = pendingCalendarRequest.value
    if (!request) {
      logger.error('No pending calendar request')
      return
    }

    try {
      const result = await addEventToCalendar(calendarUrl, request.icsContent)
      sendToIframe({
        action: 'calendarPicked',
        requestId: request.requestId,
        success: true,
        updated: result.updated,
      })
      pendingCalendarRequest.value = null
      isCalendarPickerOpen.value = false
      isProcessing.value = false
    } catch (error) {
      logger.error('Failed to add event to calendar', { error })
      calendarError.value = error instanceof Error ? error.message : 'Failed to add event'
    }
  }

  /**
   * Callback when the calendar picker is cancelled.
   */
  const onCalendarCancel = (): void => {
    const request = pendingCalendarRequest.value
    if (request) {
      sendToIframe({
        action: 'calendarPicked',
        requestId: request.requestId,
        success: false,
        error: 'Cancelled',
      })
      pendingCalendarRequest.value = null
    }
    isCalendarPickerOpen.value = false
    isProcessing.value = false
  }

  /**
   * Handle incoming postMessage from iframe.
   *
   * @param event - The postMessage event received from the iframe
   */
  const handleMessage = (event: MessageEvent): void => {
    const expectedOrigin = allowedOrigin || window.location.origin
    if (event.origin !== expectedOrigin) {
      return
    }

    const message = event.data as IframeMessage
    if (!message?.action) {
      return
    }

    logger.debug('Received message from iframe', { message })

    switch (message.action) {
      case 'pickFile':
        handlePickFile(message)
        break
      case 'saveFile':
        handleSaveFile(message)
        break
      case 'saveFiles':
        handleSaveFiles(message)
        break
      case 'createShareLink':
        handleCreateShareLink(message)
        break
      case 'pickCalendar':
        handlePickCalendar(message)
        break
      default:
        logger.debug('Unknown action', { action: (message as { action: string }).action })
    }
  }

  // Setup and cleanup
  onMounted(() => {
    if (!enabled) {
      logger.debug('IframeBridge: disabled, not listening for messages')
      return
    }
    window.addEventListener('message', handleMessage)
    logger.info('IframeBridge: listening for messages')
  })

  onBeforeUnmount(() => {
    if (!enabled) {
      return
    }
    window.removeEventListener('message', handleMessage)
    logger.info('IframeBridge: stopped listening')
  })

  return {
    // State
    isProcessing,
    enabled,
    isFilePickerOpen,
    isFileSaverOpen,
    isShareLinkPickerOpen,
    isShareOptionsOpen,
    pendingPickRequest,
    pendingSaveRequest,
    pendingShareWithOptionsRequest,
    shareServerError,
    shareServerErrorDetail,
    // Calendar picker state
    isCalendarPickerOpen,
    calendarEvent,
    calendarList,
    calendarError,
    // Callbacks for FilePicker component
    onFilesPicked,
    onFilePickerClose,
    onFolderSelected,
    onFileSaverClose,
    // Callbacks for Share Link FilePicker
    onShareLinkFilePicked,
    onShareLinkPickerClose,
    // Callbacks for Share Options Form
    onShareOptionsSubmit,
    onShareOptionsCancel,
    // Callbacks for Calendar Picker
    onCalendarSubmit,
    onCalendarCancel,
  }
}
