/**
 * Vue SFC declaration
 */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

declare module '@nextcloud/initial-state' {
  export function loadState<T = unknown>(app: string, key: string, defaultValue?: T): T
}

declare module '@nextcloud/l10n' {
  export function translate(app: string, text: string, vars?: object, count?: number, options?: object): string
  export { translate as t }
}

declare module '@nextcloud/dialogs' {
  interface FilePickerButton {
    label: string
    type?: string
    callback: (nodes: unknown[]) => void | Promise<void>
  }
  interface FilePickerBuilder {
    setMultiSelect(ms: boolean): FilePickerBuilder
    setMimeTypeFilter(filter: string[]): FilePickerBuilder
    allowDirectories(allow?: boolean): FilePickerBuilder
    addButton(button: FilePickerButton): FilePickerBuilder
    build(): { pick(): Promise<string | string[]> }
  }
  export function getFilePickerBuilder(title: string): FilePickerBuilder
}
