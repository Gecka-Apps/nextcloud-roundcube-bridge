<!--
 * Bridge container component.
 * Hosts the share options form for the iframe bridge.
 * File and folder pickers are opened programmatically via @nextcloud/dialogs.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 -->
<template>
  <div class="roundcube-bridge-container">
    <!-- Share options form (shown after file selection) -->
    <ShareOptionsForm
      v-if="isShareOptionsOpen && pendingShareWithOptionsRequest"
      :file-path="pendingShareWithOptionsRequest.path"
      :file-name="pendingShareWithOptionsRequest.filename"
      :server-error="shareServerError"
      :server-error-detail="shareServerErrorDetail"
      @submit="onShareOptionsSubmit"
      @cancel="onShareOptionsCancel"
    />
  </div>
</template>

<script>
import ShareOptionsForm from './components/ShareOptionsForm.vue'
import { useIframeBridge } from './composables/useIframeBridge'
import { ref, onMounted, defineComponent } from 'vue'

export default defineComponent({
  name: 'BridgeContainer',
  components: {
    ShareOptionsForm,
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
        console.log('[Nextbridge Roundcube Connector] Found iframe immediately')
        return
      }

      const observer = new MutationObserver(() => {
        const iframe = findRoundcubeIframe()
        if (iframe && !iframeRef.value) {
          console.log('[Nextbridge Roundcube Connector] Found iframe via MutationObserver')
          iframeRef.value = iframe
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })

      setTimeout(() => {
        if (!iframeRef.value) {
          iframeRef.value = findRoundcubeIframe()
          if (iframeRef.value) {
            console.log('[Nextbridge Roundcube Connector] Found iframe after 1s delay')
          }
        }
      }, 1000)

      setTimeout(() => {
        if (!iframeRef.value) {
          iframeRef.value = findRoundcubeIframe()
          if (iframeRef.value) {
            console.log('[Nextbridge Roundcube Connector] Found iframe after 3s delay')
          }
        }
      }, 3000)
    }

    onMounted(() => {
      setupIframeDetection()
    })

    // Enable file bridge. File/folder pickers open programmatically inside the
    // composable; only the share form is rendered here.
    const {
      isShareOptionsOpen,
      pendingShareWithOptionsRequest,
      shareServerError,
      shareServerErrorDetail,
      onShareOptionsSubmit,
      onShareOptionsCancel,
    } = useIframeBridge(iframeRef, { enabled: true })

    return {
      isShareOptionsOpen,
      pendingShareWithOptionsRequest,
      shareServerError,
      shareServerErrorDetail,
      onShareOptionsSubmit,
      onShareOptionsCancel,
    }
  },
})
</script>

<style scoped>
.roundcube-bridge-container {
  /* Container is invisible but needed for Vue mounting */
}
</style>
