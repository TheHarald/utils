import { ThemeStore } from './themeStore'

/**
 * Корневое хранилище приложения.
 * Здесь живут только общие сторы; инструменты создают свои в ленивых чанках.
 */
export class RootStore {
  readonly theme = new ThemeStore()
}

export const rootStore = new RootStore()

