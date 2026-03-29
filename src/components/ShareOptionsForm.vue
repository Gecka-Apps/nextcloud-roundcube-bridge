<!--
 * Share options form displayed after file selection.
 * Allows setting password, expiry date, label, and advanced options
 * before creating the share. Respects Nextcloud global sharing settings
 * fetched from the /api/share-config endpoint.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 -->
<template>
  <div class="share-options-overlay">
    <div class="share-options-form">
      <h2>{{ t('mail_roundcube_bridge', 'Share options') }}</h2>
      <div class="share-options-form__file-info">
        <img :src="fileIconUrl" :alt="fileName" class="share-options-form__file-icon">
        <span class="share-options-form__filename">{{ fileName }}</span>
      </div>

      <!-- Loading config -->
      <div v-if="!configLoaded" class="share-options-form__loading">
        <NcLoadingIcon :size="32" />
      </div>

      <!-- Sharing disabled for this user -->
      <template v-else-if="!sharingAllowed">
        <p class="share-options-form__error">
          {{ t('mail_roundcube_bridge', 'Public link sharing is not available for your account.') }}
        </p>
        <div class="share-options-form__actions">
          <NcButton type="primary" @click="$emit('cancel')">
            {{ t('mail_roundcube_bridge', 'Close') }}
          </NcButton>
        </div>
      </template>

      <template v-else>
        <!-- Label -->
        <div class="share-options-form__field">
          <NcTextField
            :value.sync="label"
            :label="t('mail_roundcube_bridge', 'Label')"
            :placeholder="t('mail_roundcube_bridge', 'e.g. recipient email')"
          />
        </div>

        <!-- Password toggle + field -->
        <div class="share-options-form__field">
          <NcCheckboxRadioSwitch
            :checked.sync="passwordEnabled"
            :disabled="passwordEnforced"
            type="switch"
          >
            {{ t('mail_roundcube_bridge', 'Protect with password') }}
            <span v-if="passwordEnforced" class="share-options-form__enforced">
              ({{ t('mail_roundcube_bridge', 'required') }})
            </span>
          </NcCheckboxRadioSwitch>
          <div v-if="passwordEnabled" class="share-options-form__password-row">
            <NcPasswordField
              :value.sync="password"
              :label="t('mail_roundcube_bridge', 'Password')"
            />
            <NcButton type="secondary" @click="generatePassword">
              {{ t('mail_roundcube_bridge', 'Generate') }}
            </NcButton>
          </div>
        </div>

        <!-- Expiry date toggle + picker -->
        <div class="share-options-form__field">
          <NcCheckboxRadioSwitch
            :checked.sync="expiryEnabled"
            :disabled="expiryEnforced"
            type="switch"
          >
            {{ expiryEnforced
              ? t('mail_roundcube_bridge', 'Expiration date (enforced)')
              : t('mail_roundcube_bridge', 'Set expiration date')
            }}
          </NcCheckboxRadioSwitch>
          <div v-if="expiryEnabled" class="share-options-form__expiry-row">
            <label for="share-expiry-date" class="share-options-form__expiry-label">
              {{ t('mail_roundcube_bridge', 'Expiration date') }}
            </label>
            <input
              id="share-expiry-date"
              v-model="expiryDate"
              type="date"
              :min="minDate"
              :max="maxDate"
              class="share-options-form__date-input"
            >
            <p v-if="expiryError" class="share-options-form__error">
              {{ expiryError }}
            </p>
          </div>
        </div>

        <!-- Advanced settings toggle -->
        <div class="share-options-form__advanced-toggle">
          <NcButton type="tertiary" @click="advancedOpen = !advancedOpen">
            {{ t('mail_roundcube_bridge', 'Advanced settings') }}
            <span :class="['share-options-form__caret', { 'share-options-form__caret--open': advancedOpen }]" />
          </NcButton>
        </div>

        <!-- Advanced settings section -->
        <div v-if="advancedOpen" class="share-options-form__advanced">
          <!-- Hide download (only when server allows view without download) -->
          <div v-if="allowViewWithoutDownload" class="share-options-form__field">
            <NcCheckboxRadioSwitch :checked.sync="hideDownload" type="switch">
              {{ t('mail_roundcube_bridge', 'Hide download') }}
            </NcCheckboxRadioSwitch>
          </div>

          <!-- Note to recipient -->
          <div class="share-options-form__field">
            <NcCheckboxRadioSwitch :checked.sync="noteEnabled" type="switch">
              {{ t('mail_roundcube_bridge', 'Note to recipient') }}
            </NcCheckboxRadioSwitch>
            <NcTextArea
              v-if="noteEnabled"
              :value.sync="note"
              :label="t('mail_roundcube_bridge', 'Note to recipient')"
              :placeholder="t('mail_roundcube_bridge', 'Enter a note for the share recipient')"
              class="share-options-form__note"
            />
          </div>

          <!-- Video verification (Talk required + password must be enabled) -->
          <div v-if="talkEnabled && passwordEnabled" class="share-options-form__field">
            <NcCheckboxRadioSwitch :checked.sync="sendPasswordByTalk" type="switch">
              {{ t('mail_roundcube_bridge', 'Video verification') }}
            </NcCheckboxRadioSwitch>
          </div>

          <!-- Custom permissions -->
          <div class="share-options-form__field">
            <NcCheckboxRadioSwitch :checked.sync="customPermissions" type="switch">
              {{ t('mail_roundcube_bridge', 'Custom permissions') }}
            </NcCheckboxRadioSwitch>
            <div v-if="customPermissions" class="share-options-form__permissions">
              <NcCheckboxRadioSwitch :checked="true" :disabled="true" type="switch">
                {{ t('mail_roundcube_bridge', 'Read') }}
              </NcCheckboxRadioSwitch>
              <NcCheckboxRadioSwitch :checked.sync="permRead" type="switch">
                {{ t('mail_roundcube_bridge', 'Edit') }}
              </NcCheckboxRadioSwitch>
              <NcCheckboxRadioSwitch :checked.sync="permDelete" type="switch">
                {{ t('mail_roundcube_bridge', 'Delete') }}
              </NcCheckboxRadioSwitch>
            </div>
          </div>
        </div>

        <!-- Server error -->
        <div v-if="serverError" class="share-options-form__server-error">
          <p class="share-options-form__server-error-message">
            {{ t('mail_roundcube_bridge', 'An error occurred while creating the share link. Please check your settings and try again.') }}
          </p>
          <details v-if="serverErrorDetail" class="share-options-form__server-error-details">
            <summary>{{ t('mail_roundcube_bridge', 'Technical details') }}</summary>
            <pre>{{ serverErrorDetail }}</pre>
          </details>
        </div>

        <!-- Actions -->
        <div class="share-options-form__actions">
          <NcButton type="tertiary" @click="$emit('cancel')">
            {{ t('mail_roundcube_bridge', 'Cancel') }}
          </NcButton>
          <NcButton type="primary" @click="onSubmit">
            {{ t('mail_roundcube_bridge', 'Create share link') }}
          </NcButton>
        </div>
      </template>
    </div>
  </div>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import { generateUrl, imagePath } from '@nextcloud/router'
import axios from '@nextcloud/axios'
import { defineComponent, ref, computed, onMounted } from 'vue'
import NcButton from '@nextcloud/vue/dist/Components/NcButton.js'
import NcTextField from '@nextcloud/vue/dist/Components/NcTextField.js'
import NcPasswordField from '@nextcloud/vue/dist/Components/NcPasswordField.js'
import NcCheckboxRadioSwitch from '@nextcloud/vue/dist/Components/NcCheckboxRadioSwitch.js'
import NcTextArea from '@nextcloud/vue/dist/Components/NcTextArea.js'
import NcLoadingIcon from '@nextcloud/vue/dist/Components/NcLoadingIcon.js'

export default defineComponent({
  name: 'ShareOptionsForm',
  components: {
    NcButton,
    NcTextField,
    NcPasswordField,
    NcCheckboxRadioSwitch,
    NcTextArea,
    NcLoadingIcon,
  },
  props: {
    filePath: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      default: 'file',
    },
    serverError: {
      type: String,
      default: '',
    },
    serverErrorDetail: {
      type: String,
      default: '',
    },
  },
  emits: ['submit', 'cancel'],
  setup(props, { emit }) {
    /**
     * Map file extension to a Nextcloud core filetype icon name.
     */
    const fileIconUrl = computed(() => {
      if (props.fileType === 'folder') {
        return imagePath('core', 'filetypes/folder.svg')
      }
      const ext = (props.fileName.split('.').pop() || '').toLowerCase()
      const iconMap = {
        pdf: 'application-pdf',
        jpg: 'image', jpeg: 'image', png: 'image', gif: 'image',
        svg: 'image', webp: 'image', bmp: 'image', ico: 'image',
        doc: 'x-office-document', docx: 'x-office-document',
        odt: 'x-office-document', rtf: 'x-office-document',
        xls: 'x-office-spreadsheet', xlsx: 'x-office-spreadsheet',
        ods: 'x-office-spreadsheet', csv: 'x-office-spreadsheet',
        ppt: 'x-office-presentation', pptx: 'x-office-presentation',
        odp: 'x-office-presentation',
        mp4: 'video', avi: 'video', mkv: 'video', webm: 'video', mov: 'video',
        mp3: 'audio', ogg: 'audio', flac: 'audio', wav: 'audio', m4a: 'audio',
        zip: 'package-x-generic', gz: 'package-x-generic', tar: 'package-x-generic',
        rar: 'package-x-generic', '7z': 'package-x-generic',
        txt: 'text', md: 'text', log: 'text',
        js: 'text-code', ts: 'text-code', py: 'text-code', php: 'text-code',
        html: 'text-code', css: 'text-code', json: 'text-code', xml: 'text-code',
        ttf: 'font', otf: 'font', woff: 'font', woff2: 'font',
        ics: 'text-calendar',
        vcf: 'text-vcard',
      }
      const icon = iconMap[ext] || 'file'
      return imagePath('core', 'filetypes/' + icon + '.svg')
    })

    // Config state
    const configLoaded = ref(false)
    const sharingAllowed = ref(true)
    const passwordEnforced = ref(false)
    const expiryEnforced = ref(false)
    const talkEnabled = ref(false)
    const allowViewWithoutDownload = ref(true)

    // Form fields — basic
    const label = ref('')
    const passwordEnabled = ref(false)
    const password = ref('')
    const expiryEnabled = ref(false)
    const expiryDate = ref('')
    const expiryError = ref('')

    // Form fields — advanced
    const advancedOpen = ref(false)
    const hideDownload = ref(false)
    const noteEnabled = ref(false)
    const note = ref('')
    const sendPasswordByTalk = ref(false)
    const customPermissions = ref(false)
    const permRead = ref(false)
    const permDelete = ref(false)

    /**
     * Format a Date as YYYY-MM-DD in local timezone.
     */
    function toLocalDateString(date) {
      const y = date.getFullYear()
      const m = String(date.getMonth() + 1).padStart(2, '0')
      const d = String(date.getDate()).padStart(2, '0')
      return `${y}-${m}-${d}`
    }

    // Tomorrow as minimum date (local timezone)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const minDate = toLocalDateString(tomorrow)

    // Max date (only set when enforced)
    const maxDate = ref('')

    /**
     * Generate a random password (16 chars, alphanumeric + special).
     */
    function generatePassword() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*'
      const array = new Uint8Array(16)
      crypto.getRandomValues(array)
      password.value = Array.from(array, (b) => chars[b % chars.length]).join('')
    }

    /**
     * Fetch consolidated share config from the bridge API.
     */
    onMounted(async () => {
      try {
        const response = await axios.get(
          generateUrl('/apps/mail_roundcube_bridge/api/share-config'),
        )
        const config = response.data

        // Check if sharing is allowed for this user
        if (!config.sharingEnabled || !config.publicLinksEnabled || config.sharingDisabled) {
          sharingAllowed.value = false
          configLoaded.value = true
          return
        }

        passwordEnforced.value = config.password?.enforced ?? false
        const passwordEnabledByDefault = config.password?.enabledByDefault ?? false
        expiryEnforced.value = config.expireDate?.enforced ?? false
        talkEnabled.value = config.talkEnabled ?? false
        allowViewWithoutDownload.value = config.allowViewWithoutDownload ?? true

        const expiryDays = config.expireDate?.days ?? 7
        const expiryDefaultEnabled = config.expireDate?.enabled ?? false

        // Password: enable + generate if enforced or enabled by default
        passwordEnabled.value = passwordEnforced.value || passwordEnabledByDefault
        if (passwordEnabled.value) {
          generatePassword()
        }

        // Expiry: enable if enforced or server default
        expiryEnabled.value = expiryEnforced.value || expiryDefaultEnabled

        // Default expiry date
        const defaultExpiry = new Date()
        defaultExpiry.setDate(defaultExpiry.getDate() + expiryDays)
        expiryDate.value = toLocalDateString(defaultExpiry)

        // Max date when enforced
        if (expiryEnforced.value) {
          maxDate.value = toLocalDateString(defaultExpiry)
        }
      } catch (error) {
        console.error('[RC-Bridge] Failed to load share config, using defaults', error)
        // Sensible defaults when API fails
        expiryEnabled.value = true
        const defaultExpiry = new Date()
        defaultExpiry.setDate(defaultExpiry.getDate() + 7)
        expiryDate.value = toLocalDateString(defaultExpiry)
      }

      configLoaded.value = true
    })

    function onSubmit() {
      expiryError.value = ''

      // Client-side validation: expiry date must be in the future
      if (expiryEnabled.value && expiryDate.value < minDate) {
        expiryError.value = t('mail_roundcube_bridge', 'The expiration date must be in the future.')
        return
      }

      // Client-side validation: expiry date must not exceed max
      if (expiryEnabled.value && maxDate.value && expiryDate.value > maxDate.value) {
        expiryError.value = t('mail_roundcube_bridge', 'The expiration date exceeds the maximum allowed.')
        return
      }

      // Build permissions bitfield
      let permissions = 1 // PERMISSION_READ always included
      if (customPermissions.value) {
        if (permRead.value) permissions |= 2 // PERMISSION_UPDATE
        if (permDelete.value) permissions |= 8 // PERMISSION_DELETE
      }

      emit('submit', {
        path: props.filePath,
        password: passwordEnabled.value ? password.value : '',
        expireDate: expiryEnabled.value ? expiryDate.value : '',
        label: label.value,
        note: noteEnabled.value ? note.value : '',
        hideDownload: hideDownload.value,
        permissions: customPermissions.value ? permissions : 1,
        sendPasswordByTalk: sendPasswordByTalk.value && passwordEnabled.value && talkEnabled.value,
      })
    }

    return {
      t,
      fileIconUrl,
      configLoaded,
      sharingAllowed,
      label,
      passwordEnabled,
      passwordEnforced,
      password,
      expiryEnabled,
      expiryEnforced,
      expiryDate,
      expiryError,
      minDate,
      maxDate,
      advancedOpen,
      allowViewWithoutDownload,
      hideDownload,
      noteEnabled,
      note,
      talkEnabled,
      sendPasswordByTalk,
      customPermissions,
      permRead,
      permDelete,
      generatePassword,
      onSubmit,
    }
  },
})
</script>

<style scoped>
.share-options-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9000;
}

.share-options-form {
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  background: var(--color-main-background);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.share-options-form h2 {
  margin-bottom: 4px;
}

.share-options-form__file-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding: 10px 12px;
  background: var(--color-background-dark);
  border-radius: var(--border-radius-large);
}

.share-options-form__file-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.share-options-form__filename {
  color: var(--color-main-text);
  font-weight: 500;
  word-break: break-all;
  line-height: 1.3;
}

.share-options-form__loading {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.share-options-form__field {
  margin-bottom: 16px;
}

.share-options-form__enforced {
  color: var(--color-text-maxcontrast);
  font-style: italic;
}

.share-options-form__password-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  margin-top: 8px;
}

.share-options-form__password-row .nc-password-field {
  flex: 1;
}

.share-options-form__expiry-row {
  margin-top: 8px;
}

.share-options-form__expiry-label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.9em;
  color: var(--color-text-maxcontrast);
}

.share-options-form__date-input {
  width: 100%;
  padding: 8px 10px;
  border: 2px solid var(--color-border-dark);
  border-radius: var(--border-radius-large);
  background: var(--color-main-background);
  color: var(--color-main-text);
  font-size: 1em;
}

.share-options-form__date-input:focus {
  border-color: var(--color-primary-element);
  outline: none;
}

.share-options-form__error {
  color: var(--color-error);
  font-size: 0.85em;
  margin-top: 4px;
}

.share-options-form__caret {
  display: inline-block;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 5px 0 5px 8px;
  border-color: transparent transparent transparent currentColor;
  transition: transform 0.2s ease;
}

.share-options-form__caret--open {
  transform: rotate(90deg);
}

.share-options-form__advanced-toggle {
  margin: 4px 0 8px;
}

.share-options-form__advanced {
  padding-left: 8px;
  margin-bottom: 8px;
}

.share-options-form__note {
  margin-top: 8px;
}

.share-options-form__permissions {
  margin-top: 4px;
  padding-left: 24px;
}

.share-options-form__server-error {
  background: var(--color-error);
  border-radius: var(--border-radius-large);
  padding: 12px 16px;
  margin-top: 12px;
  color: #fff;
}

.share-options-form__server-error-message {
  color: #fff;
  font-size: 0.9em;
  font-weight: 500;
  margin: 0;
}

.share-options-form__server-error-details {
  margin-top: 8px;
  font-size: 0.85em;
  color: rgba(255, 255, 255, 0.85);
}

.share-options-form__server-error-details summary {
  cursor: pointer;
  user-select: none;
  color: rgba(255, 255, 255, 0.75);
}

.share-options-form__server-error-details pre {
  margin: 4px 0 0;
  padding: 8px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: var(--border-radius);
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.95em;
  color: #fff;
}

.share-options-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}
</style>
