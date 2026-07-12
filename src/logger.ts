/**
 * Simple logger for mail_roundcube_bridge.
 *
 * Debug logs are disabled in production builds.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

/* eslint-disable no-console -- this module is the single boundary to the console */

const PREFIX = '[Nextbridge Roundcube Connector]'
const IS_DEV = process.env.NODE_ENV !== 'production'

/**
 * No-op used in place of debug/info logging in production builds.
 */
function noop() {}

const logger = {
  debug: IS_DEV ? (...args: unknown[]) => console.debug(PREFIX, ...args) : noop,
  info: IS_DEV ? (...args: unknown[]) => console.info(PREFIX, ...args) : noop,
  warn: (...args: unknown[]) => console.warn(PREFIX, ...args),
  error: (...args: unknown[]) => console.error(PREFIX, ...args),
}

export default logger
