/**
 * RoundCube Bridge - Admin settings
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

import Vue from 'vue'
import AdminSettings from './AdminSettings.vue'

new Vue({
  render: (h) => h(AdminSettings),
}).$mount('#mail_roundcube_bridge-admin-settings')
