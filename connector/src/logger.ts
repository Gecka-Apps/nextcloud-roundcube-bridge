/**
 * Logger factory for Nextbridge connector apps.
 *
 * Produces a namespaced logger whose debug/info output is stripped from
 * production builds while warnings and errors always reach the console.
 *
 * @author Laurent Dinclaux <laurent@gecka.nc>
 * @copyright 2026 Gecka
 * @license AGPL-3.0-or-later
 */

/* eslint-disable no-console -- this module is the single boundary to the console */

const IS_DEV = process.env.NODE_ENV !== 'production'

export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

/**
 * No-op used in place of debug/info logging in production builds.
 */
function noop(): void {}

/**
 * Create a logger that prefixes every message with the given tag.
 *
 * @param prefix - Tag prepended to every message, e.g. '[My Connector]'.
 * @return A logger whose debug/info are silenced in production builds.
 */
export function createLogger(prefix: string): Logger {
  return {
    debug: IS_DEV ? (...args: unknown[]) => console.debug(prefix, ...args) : noop,
    info: IS_DEV ? (...args: unknown[]) => console.info(prefix, ...args) : noop,
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args),
  }
}
