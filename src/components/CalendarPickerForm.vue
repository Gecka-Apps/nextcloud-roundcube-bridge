<!--
 * Calendar picker shown after a calendar attachment is opened.
 * Displays a Nextcloud-rendered preview of the event and lets the user choose
 * the target calendar before importing.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 -->
<template>
  <div class="calendar-picker-overlay">
    <div class="calendar-picker">
      <h2>{{ t('mail_roundcube_bridge', 'Add to calendar') }}</h2>

      <!-- Event preview -->
      <div class="calendar-picker__event">
        <div class="calendar-picker__summary">
          {{ event.summary || t('mail_roundcube_bridge', '(No title)') }}
        </div>

        <dl class="calendar-picker__fields">
          <template v-if="startLabel">
            <dt>{{ t('mail_roundcube_bridge', 'Start') }}</dt>
            <dd>{{ startLabel }}</dd>
          </template>
          <template v-if="endLabel">
            <dt>{{ t('mail_roundcube_bridge', 'End') }}</dt>
            <dd>{{ endLabel }}</dd>
          </template>
          <template v-if="event.location">
            <dt>{{ t('mail_roundcube_bridge', 'Location') }}</dt>
            <dd>{{ event.location }}</dd>
          </template>
          <template v-if="event.organizer">
            <dt>{{ t('mail_roundcube_bridge', 'Organizer') }}</dt>
            <dd>{{ formatUser(event.organizer) }}</dd>
          </template>
          <template v-if="statusLabel">
            <dt>{{ t('mail_roundcube_bridge', 'Status') }}</dt>
            <dd>{{ statusLabel }}</dd>
          </template>
          <template v-if="event.attendees && event.attendees.length">
            <dt>{{ t('mail_roundcube_bridge', 'Attendees') }}</dt>
            <dd>
              <ul class="calendar-picker__attendees">
                <li v-for="(a, i) in event.attendees" :key="i">
                  {{ formatUser(a) }}
                  <span v-if="partstatLabel(a.status)" class="calendar-picker__partstat">
                    — {{ partstatLabel(a.status) }}
                  </span>
                </li>
              </ul>
            </dd>
          </template>
        </dl>

        <p v-if="event.description" class="calendar-picker__description">
          {{ event.description }}
        </p>
      </div>

      <!-- Calendar selection -->
      <div class="calendar-picker__calendars">
        <h3>{{ t('mail_roundcube_bridge', 'Select a calendar') }}</h3>
        <button
          v-for="cal in calendars"
          :key="cal.url"
          type="button"
          class="calendar-picker__cal-row"
          :class="{ 'calendar-picker__cal-row--selected': selectedCalendar === cal.url }"
          @click="selectedCalendar = cal.url">
          <span class="calendar-picker__cal-dot" :style="{ backgroundColor: cal.color }" />
          {{ cal.displayname }}
        </button>
      </div>

      <!-- Server error -->
      <p v-if="serverError" class="calendar-picker__error">
        {{ serverError }}
      </p>

      <!-- Actions -->
      <div class="calendar-picker__actions">
        <NcButton variant="tertiary" :disabled="submitting" @click="$emit('cancel')">
          {{ t('mail_roundcube_bridge', 'Cancel') }}
        </NcButton>
        <NcButton variant="primary" :disabled="!selectedCalendar || submitting" @click="onSubmit">
          <template v-if="submitting" #icon>
            <NcLoadingIcon :size="20" />
          </template>
          {{ t('mail_roundcube_bridge', 'Add to calendar') }}
        </NcButton>
      </div>
    </div>
  </div>
</template>

<script>
import { getCanonicalLocale, translate as t } from '@nextcloud/l10n'
import { NcButton, NcLoadingIcon } from '@nextcloud/vue'
import { computed, defineComponent, ref, watch } from 'vue'

export default defineComponent({
  name: 'CalendarPickerForm',
  components: {
    NcButton,
    NcLoadingIcon,
  },

  props: {
    event: {
      type: Object,
      required: true,
    },

    calendars: {
      type: Array,
      required: true,
    },

    serverError: {
      type: String,
      default: '',
    },
  },

  emits: ['submit', 'cancel'],
  setup(props, { emit }) {
    const selectedCalendar = ref(props.calendars[0]?.url || '')
    const submitting = ref(false)

    // Reset the spinner when the parent reports a failure so the user can retry.
    watch(() => props.serverError, (error) => {
      if (error) {
        submitting.value = false
      }
    })

    /**
     * Format an ICS date object (ISO string + all-day flag) in the user's locale.
     *
     * @param {object} value - The parsed ICS date ({ date, allDay }), or null.
     */
    function formatDate(value) {
      if (!value || !value.date) {
        return ''
      }
      const date = new Date(value.date)
      if (isNaN(date.getTime())) {
        return value.date
      }
      const locale = getCanonicalLocale()
      const options = value.allDay
        ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        : { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      return new Intl.DateTimeFormat(locale, options).format(date)
    }

    const startLabel = computed(() => formatDate(props.event.start))
    const endLabel = computed(() => formatDate(props.event.end))

    /**
     * Format a calendar user as "Name <email>" or just the email.
     *
     * @param {object} user - The organizer or attendee ({ name, email }).
     */
    function formatUser(user) {
      if (!user) {
        return ''
      }
      if (user.name && user.email) {
        return `${user.name} <${user.email}>`
      }
      return user.name || user.email || ''
    }

    const statusMap = computed(() => ({
      CONFIRMED: t('mail_roundcube_bridge', 'Confirmed'),
      TENTATIVE: t('mail_roundcube_bridge', 'Tentative'),
      CANCELLED: t('mail_roundcube_bridge', 'Cancelled'),
    }))

    const statusLabel = computed(() => {
      const status = props.event.status
      if (!status) {
        return ''
      }
      return statusMap.value[status.toUpperCase()] || status
    })

    /**
     * Translate an attendee participation status.
     *
     * @param {string} status - The attendee participation status (e.g. ACCEPTED).
     */
    function partstatLabel(status) {
      if (!status) {
        return ''
      }
      const map = {
        'NEEDS-ACTION': t('mail_roundcube_bridge', 'No response'),
        ACCEPTED: t('mail_roundcube_bridge', 'Accepted'),
        DECLINED: t('mail_roundcube_bridge', 'Declined'),
        TENTATIVE: t('mail_roundcube_bridge', 'Tentative'),
      }
      return map[status.toUpperCase()] || status
    }

    /**
     *
     */
    function onSubmit() {
      if (!selectedCalendar.value) {
        return
      }
      submitting.value = true
      emit('submit', selectedCalendar.value)
    }

    return {
      t,
      selectedCalendar,
      submitting,
      startLabel,
      endLabel,
      statusLabel,
      formatUser,
      partstatLabel,
      onSubmit,
    }
  },
})
</script>

<style scoped>
.calendar-picker-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9000;
}

.calendar-picker {
  max-width: 480px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px;
  background: var(--color-main-background);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

.calendar-picker h2 {
  margin-bottom: 16px;
}

.calendar-picker__event {
  padding: 16px;
  background: var(--color-background-dark);
  border-radius: var(--border-radius-large);
  margin-bottom: 20px;
}

.calendar-picker__summary {
  font-size: 1.15em;
  font-weight: bold;
  color: var(--color-main-text);
  margin-bottom: 12px;
  word-break: break-word;
}

.calendar-picker__fields {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 4px 12px;
  margin: 0;
}

.calendar-picker__fields dt {
  color: var(--color-text-maxcontrast);
  font-weight: 500;
}

.calendar-picker__fields dd {
  margin: 0;
  color: var(--color-main-text);
  word-break: break-word;
}

.calendar-picker__attendees {
  list-style: none;
  margin: 0;
  padding: 0;
}

.calendar-picker__partstat {
  color: var(--color-text-maxcontrast);
}

.calendar-picker__description {
  margin: 12px 0 0;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--color-main-text);
}

.calendar-picker__calendars h3 {
  font-size: 1em;
  font-weight: 500;
  margin-bottom: 8px;
}

.calendar-picker__cal-row {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: var(--border-radius-large);
  background: transparent;
  color: var(--color-main-text);
  font-size: 1em;
  text-align: left;
  cursor: pointer;
}

.calendar-picker__cal-row:hover {
  background: var(--color-background-hover);
}

.calendar-picker__cal-row--selected {
  background: var(--color-primary-element-light);
}

.calendar-picker__cal-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 8px;
  flex-shrink: 0;
}

.calendar-picker__error {
  color: var(--color-error);
  font-size: 0.9em;
  margin-top: 12px;
}

.calendar-picker__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}
</style>
