<!--
 * Bridge container component.
 * Hosts the share options form and calendar picker for the iframe bridge.
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
      :filePath="pendingShareWithOptionsRequest.path"
      :fileName="pendingShareWithOptionsRequest.filename"
      :serverError="shareServerError"
      :serverErrorDetail="shareServerErrorDetail"
      @submit="onShareOptionsSubmit"
      @cancel="onShareOptionsCancel" />
    <!-- Calendar picker with event preview (shown for calendar attachments) -->
    <CalendarPickerForm
      v-if="isCalendarPickerOpen && calendarEvent"
      :event="calendarEvent"
      :calendars="calendarList"
      :serverError="calendarError"
      @submit="onCalendarSubmit"
      @cancel="onCalendarCancel" />
  </div>
</template>

<script>
import { defineComponent, onMounted, ref } from 'vue'
import CalendarPickerForm from './components/CalendarPickerForm.vue'
import ShareOptionsForm from './components/ShareOptionsForm.vue'
import { useIframeBridge } from './composables/useIframeBridge'
import logger from './logger'

export default defineComponent({
  name: 'BridgeContainer',
  components: {
    ShareOptionsForm,
    CalendarPickerForm,
  },

  setup() {
    // Reference to the RoundCube iframe
    const iframeRef = ref(null)

    // Find the RoundCube iframe by ID or name
    /**
     *
     */
    function findRoundcubeIframe() {
      let iframe = document.getElementById('mail_roundcube-frame')
      if (iframe) {
        return iframe
      }

      iframe = document.querySelector('iframe[name="mail_roundcube"]')
      return iframe
    }

    // Setup iframe detection
    /**
     *
     */
    function setupIframeDetection() {
      iframeRef.value = findRoundcubeIframe()
      if (iframeRef.value) {
        logger.debug('Found iframe immediately')
        return
      }

      const observer = new MutationObserver(() => {
        const iframe = findRoundcubeIframe()
        if (iframe && !iframeRef.value) {
          logger.debug('Found iframe via MutationObserver')
          iframeRef.value = iframe
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })

      setTimeout(() => {
        if (!iframeRef.value) {
          iframeRef.value = findRoundcubeIframe()
          if (iframeRef.value) {
            logger.debug('Found iframe after 1s delay')
          }
        }
      }, 1000)

      setTimeout(() => {
        if (!iframeRef.value) {
          iframeRef.value = findRoundcubeIframe()
          if (iframeRef.value) {
            logger.debug('Found iframe after 3s delay')
          }
        }
      }, 3000)
    }

    onMounted(() => {
      setupIframeDetection()
    })

    // Enable file bridge. File/folder pickers open programmatically inside the
    // composable; only the share and calendar forms are rendered here.
    const {
      isShareOptionsOpen,
      pendingShareWithOptionsRequest,
      shareServerError,
      shareServerErrorDetail,
      isCalendarPickerOpen,
      calendarEvent,
      calendarList,
      calendarError,
      onShareOptionsSubmit,
      onShareOptionsCancel,
      onCalendarSubmit,
      onCalendarCancel,
    } = useIframeBridge(iframeRef, { enabled: true })

    return {
      isShareOptionsOpen,
      pendingShareWithOptionsRequest,
      shareServerError,
      shareServerErrorDetail,
      isCalendarPickerOpen,
      calendarEvent,
      calendarList,
      calendarError,
      onShareOptionsSubmit,
      onShareOptionsCancel,
      onCalendarSubmit,
      onCalendarCancel,
    }
  },
})
</script>

<style scoped>
.roundcube-bridge-container {
  /* Container is invisible but needed for Vue mounting */
}
</style>
