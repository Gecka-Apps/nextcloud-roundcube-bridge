<!--
 * Admin settings for mail_roundcube_bridge.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 -->
<template>
  <div class="mail-roundcube-bridge-admin">
    <NcSettingsSection
      :name="t('mail_roundcube_bridge', 'Nextcloud Bridge')"
      :description="t('mail_roundcube_bridge', 'Integration with Nextcloud services (files, calendar).')"
    >
      <NcCheckboxRadioSwitch
        :checked="enabled"
        :loading="loading"
        @update:checked="setEnabled"
      >
        {{ t('mail_roundcube_bridge', 'Enable Nextcloud bridge') }}
      </NcCheckboxRadioSwitch>
      <p class="hint">
        {{ t('mail_roundcube_bridge', 'Requires the NextBridge plugin installed in RoundCube.') }}
        <a href="https://github.com/Gecka-Apps/NextBridge" target="_blank">GitHub</a>
      </p>

      <div v-if="enabled" class="features">
        <h4>{{ t('mail_roundcube_bridge', 'Available features:') }}</h4>
        <ul>
          <li>{{ t('mail_roundcube_bridge', 'Attach files from Nextcloud') }}</li>
          <li>{{ t('mail_roundcube_bridge', 'Save attachments to Nextcloud') }}</li>
          <li>{{ t('mail_roundcube_bridge', 'Insert share links') }}</li>
          <li>{{ t('mail_roundcube_bridge', 'Add calendar invitations to Nextcloud Calendar') }}</li>
        </ul>
      </div>
    </NcSettingsSection>
  </div>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'
import { loadState } from '@nextcloud/initial-state'
import axios from '@nextcloud/axios'
import { NcSettingsSection, NcCheckboxRadioSwitch } from '@nextcloud/vue'

export default {
  name: 'AdminSettings',
  components: {
    NcSettingsSection,
    NcCheckboxRadioSwitch,
  },
  data() {
    return {
      enabled: false,
      loading: false,
    }
  },
  mounted() {
    try {
      const state = loadState('mail_roundcube_bridge', 'admin')
      this.enabled = state?.enabled === 'yes'
    } catch {
      // State not available
    }
  },
  methods: {
    t,
    async setEnabled(value) {
      this.loading = true
      try {
        await axios.post(generateUrl('/apps/mail_roundcube_bridge/settings/admin/enabled'), {
          value: value ? 'yes' : 'no',
        })
        this.enabled = value
      } catch (error) {
        console.error('Failed to save setting', error)
      } finally {
        this.loading = false
      }
    },
  },
}
</script>

<style scoped>
.mail-roundcube-bridge-admin {
  margin-top: 1em;
}

.hint {
  color: var(--color-text-maxcontrast);
  font-size: 0.9em;
  margin-top: 0.5em;
}

.hint a {
  color: var(--color-primary-element);
}

.features {
  margin-top: 1em;
  padding: 1em;
  background: var(--color-background-hover);
  border-radius: var(--border-radius);
}

.features h4 {
  margin: 0 0 0.5em 0;
  font-weight: bold;
}

.features ul {
  margin: 0;
  padding-left: 1.5em;
}

.features li {
  margin: 0.2em 0;
}
</style>
