// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeStore } from './themeStore'

const STORAGE_KEY = 'utils:theme'

type ChangeListener = (event: { matches: boolean }) => void

/**
 * jsdom не реализует matchMedia, поэтому подставляем минимальный стенд,
 * который умеет «переключать» системную тему и рассылать событие change.
 */
function installMatchMedia(initialDark: boolean) {
  const listeners = new Set<ChangeListener>()
  const state = { dark: initialDark }

  const mediaQuery = {
    media: '(prefers-color-scheme: dark)',
    get matches() {
      return state.dark
    },
    addEventListener: (_type: string, listener: ChangeListener) => {
      listeners.add(listener)
    },
    removeEventListener: (_type: string, listener: ChangeListener) => {
      listeners.delete(listener)
    },
  }

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mediaQuery),
  )

  return {
    listeners,
    setDark(dark: boolean) {
      state.dark = dark
      listeners.forEach((listener) => listener({ matches: dark }))
    },
  }
}

function isDarkClassApplied(): boolean {
  return document.documentElement.classList.contains('dark')
}

let system = installMatchMedia(false)
let store: ThemeStore | null = null

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  system = installMatchMedia(false)
})

afterEach(() => {
  store?.dispose()
  store = null
  vi.unstubAllGlobals()
})

describe('ThemeStore', () => {
  it('по умолчанию следует системе', () => {
    store = new ThemeStore()
    expect(store.mode).toBe('system')
    expect(store.resolvedMode).toBe('light')
    expect(store.isDark).toBe(false)
    expect(isDarkClassApplied()).toBe(false)
  })

  it('подхватывает сохранённый режим', () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    store = new ThemeStore()
    expect(store.mode).toBe('dark')
    expect(store.resolvedMode).toBe('dark')
    expect(isDarkClassApplied()).toBe(true)
  })

  it('игнорирует мусор в localStorage', () => {
    localStorage.setItem(STORAGE_KEY, 'neon')
    store = new ThemeStore()
    expect(store.mode).toBe('system')
  })

  it('реагирует на смену системной темы в режиме system', () => {
    store = new ThemeStore()
    system.setDark(true)
    expect(store.resolvedMode).toBe('dark')
    expect(isDarkClassApplied()).toBe(true)

    system.setDark(false)
    expect(store.resolvedMode).toBe('light')
    expect(isDarkClassApplied()).toBe(false)
  })

  it('в явном режиме системные изменения не применяются', () => {
    store = new ThemeStore()
    store.setMode('light')
    system.setDark(true)
    expect(store.resolvedMode).toBe('light')
    expect(isDarkClassApplied()).toBe(false)
  })

  it('setMode сохраняет выбор и обновляет документ', () => {
    store = new ThemeStore()
    store.setMode('dark')

    expect(store.isDark).toBe(true)
    expect(isDarkClassApplied()).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
  })

  it('toggle переключает между светлой и тёмной', () => {
    store = new ThemeStore()
    store.toggle()
    expect(store.mode).toBe('dark')
    expect(store.isDark).toBe(true)

    store.toggle()
    expect(store.mode).toBe('light')
    expect(store.isDark).toBe(false)
    expect(isDarkClassApplied()).toBe(false)
  })

  it('dispose отписывается от системных изменений', () => {
    store = new ThemeStore()
    store.dispose()
    expect(system.listeners.size).toBe(0)

    system.setDark(true)
    expect(store.resolvedMode).toBe('light')
    store = null
  })
})
