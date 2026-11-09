import { computed, makeAutoObservable, observable } from 'mobx'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'utils:theme'
const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system'
}

function readStoredMode(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isThemeMode(stored)) return stored
  } catch {
    /* приватный режим — работаем без сохранения */
  }
  return 'system'
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DARK_MEDIA_QUERY).matches
}

/** Тема оформления: светлая / тёмная / как в системе, с сохранением выбора. */
export class ThemeStore {
  mode: ThemeMode = 'system'
  /** Текущее значение системной темы — наблюдаемое, чтобы UI реагировал на её смену. */
  private systemDark = systemPrefersDark()
  private mediaQuery: MediaQueryList | null = null

  constructor() {
    this.mode = readStoredMode()
    makeAutoObservable<ThemeStore, 'mediaQuery' | 'systemDark'>(
      this,
      {
        mode: observable,
        systemDark: observable,
        resolvedMode: computed,
        isDark: computed,
        mediaQuery: false,
      },
      { autoBind: true },
    )
    this.applyTheme()
    if (typeof window !== 'undefined') {
      this.mediaQuery = window.matchMedia(DARK_MEDIA_QUERY)
      this.mediaQuery.addEventListener('change', this.handleSystemChange)
    }
  }

  get resolvedMode(): ResolvedTheme {
    if (this.mode === 'system') return this.systemDark ? 'dark' : 'light'
    return this.mode
  }

  get isDark(): boolean {
    return this.resolvedMode === 'dark'
  }

  setMode(mode: ThemeMode): void {
    this.mode = mode
    try {
      window.localStorage.setItem(STORAGE_KEY, mode)
    } catch {
      /* игнорируем ошибки приватного режима */
    }
    this.applyTheme()
  }

  toggle(): void {
    this.setMode(this.isDark ? 'light' : 'dark')
  }

  dispose(): void {
    this.mediaQuery?.removeEventListener('change', this.handleSystemChange)
    this.mediaQuery = null
  }

  private handleSystemChange(): void {
    this.systemDark = systemPrefersDark()
    if (this.mode === 'system') this.applyTheme()
  }

  private applyTheme(): void {
    const dark = this.isDark
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
  }
}
