<!--
 * Bridge container component.
 * Handles file picker dialogs for the iframe bridge.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 -->
<template>
  <div class="roundcube-bridge-container">
    <!-- File picker for attaching files from Nextcloud -->
    <FilePicker
      v-if="isFilePickerOpen"
      :name="t('mail_roundcube_bridge', 'Choose a file to add as attachment')"
      :buttons="filePickerButtons"
      @close="onFilePickerClose"
    />
    <!-- Folder picker for saving attachments to Nextcloud -->
    <FilePicker
      v-if="isFileSaverOpen"
      :name="t('mail_roundcube_bridge', 'Choose a folder to store the attachment in')"
      :buttons="fileSaverButtons"
      :allow-pick-directory="true"
      :multiselect="false"
      :mimetype-filter="['httpd/unix-directory']"
      @close="onFileSaverClose"
    />
    <!-- File picker for creating share links -->
    <FilePicker
      v-if="isShareLinkPickerOpen"
      :name="t('mail_roundcube_bridge', 'Choose a file to share as a link')"
      :buttons="shareLinkPickerButtons"
      :multiselect="false"
      @close="onShareLinkPickerClose"
    />
  </div>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import { FilePickerVue as FilePicker } from '@nextcloud/dialogs/filepicker.js'
import { useIframeBridge } from './composables/useIframeBridge'
import { ref, onMounted, defineComponent } from 'vue'

export default defineComponent({
  name: 'BridgeContainer',
  components: {
    FilePicker,
  },
  setup() {
    // Reference to the RoundCube iframe
    const iframeRef = ref(null)

    // Find the RoundCube iframe by ID or name
    function findRoundcubeIframe() {
      let iframe = document.getElementById('mail_roundcube-frame')
      if (iframe) return iframe

      iframe = document.querySelector('iframe[name="mail_roundcube"]')
      return iframe
    }

    // Setup iframe detection
    function setupIframeDetection() {
      iframeRef.value = findRoundcubeIframe()
      if (iframeRef.value) {
        console.log('[RoundCube Bridge] Found iframe immediately')
        return
      }

      const observer = new MutationObserver(() => {
        const iframe = findRoundcubeIframe()
        if (iframe && !iframeRef.value) {
          console.log('[RoundCube Bridge] Found iframe via MutationObserver')
          iframeRef.value = iframe
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })

      setTimeout(() => {
        if (!iframeRef.value) {
          iframeRef.value = findRoundcubeIframe()
          if (iframeRef.value) {
            console.log('[RoundCube Bridge] Found iframe after 1s delay')
          }
        }
      }, 1000)

      setTimeout(() => {
        if (!iframeRef.value) {
          iframeRef.value = findRoundcubeIframe()
          if (iframeRef.value) {
            console.log('[RoundCube Bridge] Found iframe after 3s delay')
          }
        }
      }, 3000)
    }

    onMounted(() => {
      setupIframeDetection()
    })

    // Enable file bridge
    const {
      isFilePickerOpen,
      isFileSaverOpen,
      isShareLinkPickerOpen,
      onFilesPicked,
      onFilePickerClose,
      onFolderSelected,
      onFileSaverClose,
      onShareLinkFilePicked,
      onShareLinkPickerClose,
    } = useIframeBridge(iframeRef, { enabled: true })

    // Button configs
    const filePickerButtons = [
      {
        label: t('mail_roundcube_bridge', 'Choose'),
        callback: onFilesPicked,
        type: 'primary',
      },
    ]

    const fileSaverButtons = [
      {
        label: t('mail_roundcube_bridge', 'Choose'),
        callback: onFolderSelected,
        type: 'primary',
      },
    ]

    const shareLinkPickerButtons = [
      {
        label: t('mail_roundcube_bridge', 'Share'),
        callback: onShareLinkFilePicked,
        type: 'primary',
      },
    ]

    return {
      t,
      isFilePickerOpen,
      isFileSaverOpen,
      isShareLinkPickerOpen,
      onFilePickerClose,
      onFileSaverClose,
      onShareLinkPickerClose,
      filePickerButtons,
      fileSaverButtons,
      shareLinkPickerButtons,
    }
  },
})
</script>

<style scoped>
.roundcube-bridge-container {
  /* Container is invisible but needed for Vue mounting */
}
</style>
