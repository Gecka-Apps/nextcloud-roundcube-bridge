/**
 * Vue SFC declaration
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/**
 * Nextcloud modules without type declarations
 */
declare module '@nextcloud/dialogs' {
  export interface FilePickerBuilder {
    setMultiSelect(multi: boolean): FilePickerBuilder
    setType(type: number): FilePickerBuilder
    allowDirectories(allow: boolean): FilePickerBuilder
    build(): FilePicker
  }

  export interface FilePicker {
    pick(): Promise<string | string[]>
  }

  export function getFilePickerBuilder(title: string): FilePickerBuilder

  export const FilePickerType: {
    Choose: number
    Move: number
    Copy: number
    CopyMove: number
    Custom: number
  }

  export function showError(message: string, options?: object): void
  export function showSuccess(message: string, options?: object): void
  export function showInfo(message: string, options?: object): void
  export function showWarning(message: string, options?: object): void
}

declare module '@nextcloud/vue/dist/Components/NcSettingsSection.js' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<any, any, any>
  export default component
}

declare module '@nextcloud/vue/dist/Components/NcCheckboxRadioSwitch.js' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<any, any, any>
  export default component
}

declare module '@nextcloud/initial-state' {
  export function loadState<T = unknown>(app: string, key: string, defaultValue?: T): T
}

declare module '@nextcloud/l10n' {
  export function translate(app: string, text: string, vars?: object, count?: number, options?: object): string
  export { translate as t }
}
