/**
 * RoundCube Bridge - Main entry point
 *
 * Mounts the Vue bridge container and injects the NextcloudBridge client
 * into the RoundCube iframe for file/calendar integration.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

import Vue from 'vue'
import BridgeContainer from './BridgeContainer.vue'
import logger from './logger'

// Import dialogs styles for FilePicker component
import '@nextcloud/dialogs/style.css'

logger.info('Initializing...')

// ============================================================================
// Bridge Client Injection
// ============================================================================

/**
 * Inject the Nextcloud bridge client into the iframe.
 * This enables file/calendar integration via postMessage.
 */
function injectBridgeClient(iframe: HTMLIFrameElement): void {
  try {
    const iframeWindow = iframe.contentWindow
    const iframeDocument = iframe.contentDocument

    if (!iframeWindow || !iframeDocument) {
      logger.error('Cannot access iframe content')
      return
    }

    // Check if already injected
    if ((iframeWindow as { NextcloudBridge?: unknown }).NextcloudBridge) {
      logger.debug('Already injected')
      return
    }

    const script = iframeDocument.createElement('script')
    script.textContent = `
      (function() {
        if (window.NextcloudBridge) return;

        var pendingRequests = {};

        window.NextcloudBridge = {
          generateRequestId: function() {
            return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          },

          handleMessage: function(event) {
            var data = event.data;
            if (!data || !data.requestId || !data.action) return;
            var pending = pendingRequests[data.requestId];
            if (!pending) return;
            delete pendingRequests[data.requestId];
            if (data.success) {
              pending.resolve(data);
            } else {
              pending.reject(new Error(data.error || 'Unknown error'));
            }
          },

          sendAndWait: function(message, timeoutMs) {
            var self = this;
            timeoutMs = timeoutMs || 300000;
            return new Promise(function(resolve, reject) {
              var requestId = self.generateRequestId();
              message.requestId = requestId;
              pendingRequests[requestId] = { resolve: resolve, reject: reject };
              setTimeout(function() {
                if (pendingRequests[requestId]) {
                  delete pendingRequests[requestId];
                  reject(new Error('Request timeout'));
                }
              }, timeoutMs);
              window.parent.postMessage(message, '*');
            });
          },

          pickFiles: function(options) {
            options = options || {};
            return this.sendAndWait({
              action: 'pickFile',
              multiple: options.multiple !== false,
              mimeTypes: options.mimeTypes
            }).then(function(response) {
              return response.files || [];
            });
          },

          saveFile: function(filename, content, mimeType) {
            return this.sendAndWait({
              action: 'saveFile',
              filename: filename,
              content: content,
              mimeType: mimeType
            }).then(function(response) {
              return response.path || '';
            });
          },

          saveFiles: function(files) {
            return this.sendAndWait({
              action: 'saveFiles',
              files: files
            }).then(function(response) {
              return response.path || '';
            });
          },

          createShareLink: function() {
            return this.sendAndWait({
              action: 'createShareLink'
            }).then(function(response) {
              return {
                url: response.url || '',
                filename: response.filename || ''
              };
            });
          },

          getCalendars: function() {
            return this.sendAndWait({
              action: 'getCalendars'
            }).then(function(response) {
              return response.calendars || [];
            });
          },

          addToCalendar: function(calendarUrl, icsContent) {
            return this.sendAndWait({
              action: 'addToCalendar',
              calendarUrl: calendarUrl,
              icsContent: icsContent
            });
          },

          blobToBase64: function(blob) {
            return new Promise(function(resolve, reject) {
              var reader = new FileReader();
              reader.onload = function() {
                var result = reader.result;
                var base64 = result.split(',')[1] || result;
                resolve(base64);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          },

          base64ToBlob: function(base64, mimeType) {
            mimeType = mimeType || 'application/octet-stream';
            var binary = atob(base64);
            var bytes = new Uint8Array(binary.length);
            for (var i = 0; i < binary.length; i++) {
              bytes[i] = binary.charCodeAt(i);
            }
            return new Blob([bytes], { type: mimeType });
          }
        };

        window.addEventListener('message', function(e) {
          window.NextcloudBridge.handleMessage(e);
        });
      })();
    `
    iframeDocument.head.appendChild(script)
    logger.debug('Injected bridge client into iframe')
  } catch (error) {
    logger.error('Failed to inject bridge client', error)
  }
}

// ============================================================================
// Iframe Detection
// ============================================================================

function isRoundcubeIframe(iframe: HTMLIFrameElement): boolean {
  if (iframe.id === 'mail_roundcube-frame') return true
  if (iframe.name === 'mail_roundcube') return true
  return false
}

function findAndSetupIframe(): HTMLIFrameElement | null {
  // Try by ID first, then by name
  let iframe = document.getElementById('mail_roundcube-frame') as HTMLIFrameElement | null
  if (!iframe) {
    iframe = document.querySelector('iframe[name="mail_roundcube"]') as HTMLIFrameElement | null
  }

  if (iframe) {
    logger.debug('Found RoundCube iframe:', iframe.id || iframe.name || iframe.src?.substring(0, 50))

    // Setup load handler for injection
    const doInject = () => injectBridgeClient(iframe!)

    try {
      if (iframe.contentDocument?.readyState === 'complete') {
        logger.debug('Iframe already loaded, injecting now')
        doInject()
      } else {
        logger.debug('Waiting for iframe load')
        iframe.addEventListener('load', doInject)
      }
    } catch (e) {
      // Cross-origin - try anyway
      logger.debug('Cross-origin, trying to inject anyway')
      doInject()
    }

    return iframe
  }

  return null
}

function watchForIframe(): void {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLIFrameElement && isRoundcubeIframe(node)) {
          logger.debug('MutationObserver: Found new RoundCube iframe')
          node.addEventListener('load', () => {
            logger.debug('Iframe loaded (from observer)')
            injectBridgeClient(node)
          })
        }
      }
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  // Check immediately
  findAndSetupIframe()

  // Also check with delays
  setTimeout(() => {
    findAndSetupIframe()
  }, 1000)

  setTimeout(() => {
    findAndSetupIframe()
  }, 3000)
}

// ============================================================================
// Initialization
// ============================================================================

// Create mount point for Vue component
const mountPoint = document.createElement('div')
mountPoint.id = 'mail_roundcube_bridge-container'
document.body.appendChild(mountPoint)

// Mount Vue component
new Vue({
  render: (h) => h(BridgeContainer),
}).$mount('#mail_roundcube_bridge-container')

// Start watching for iframe
watchForIframe()

logger.info('Ready')
