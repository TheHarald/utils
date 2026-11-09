import { autorun, isObservable, runInAction } from 'mobx'
import { pcmDuration, createPcm } from '../src/features/voice-recorder/lib/pcm'
import { VoiceRecorderStore } from '../src/features/voice-recorder/store/VoiceRecorderStore'

/**
 * Проверка состояния редактора без браузера: аннотации MobX,
 * выделение, правки, отмена и оценка размера экспорта.
 * Запуск: npm run check:store
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const store = new VoiceRecorderStore()
const pcm = createPcm(8000, 1, 8000)
for (let i = 0; i < pcm.channels[0].length; i += 1) {
  pcm.channels[0][i] = Math.sin((2 * Math.PI * 220 * i) / 8000) * 0.5
}

// Имитируем результат stopRecording (без Web Audio API).
runInAction(() => {
  store.pcm = pcm
  store.original = pcm
  store.sourceMimeType = 'audio/webm;codecs=opus'
  store.selectionStart = 0
  store.selectionEnd = pcmDuration(pcm)
  store.status = 'ready'
})

assert(!isObservable(store.pcm), 'PcmData не должен превращаться в глубоко наблюдаемый объект')
assert(!isObservable(store.pcm?.channels), 'Каналы не должны быть observable-массивом')
assert(store.duration === 1, `Ожидалась длительность 1 c, получено ${store.duration}`)
assert(store.sourceFormatLabel === 'WebM/Opus', 'Неверная подпись исходного формата')
assert(!store.hasSelection, 'Вся запись не считается выделением')

// Реактивность: computed-значения должны обновляться при правках.
const snapshots: string[] = []
const dispose = autorun(() => {
  snapshots.push(`${store.duration.toFixed(2)}:${store.canUndo ? 'undo' : '-'}`)
})

store.setSelection(0.25, 0.75)
assert(Math.abs(store.selectionStart - 0.25) < 1e-6, 'Начало выделения задано неверно')
assert(store.hasSelection, 'После setSelection выделение должно появиться')
assert(Math.abs(store.selectionDuration - 0.5) < 1e-6, 'Длительность выделения неверна')

assert(store.trimToSelection(), 'Обрезка должна выполниться')
assert(Math.abs(store.duration - 0.5) < 1e-6, `После обрезки ожидалось 0.5 c, получено ${store.duration}`)
assert(store.canUndo, 'После правки должна быть доступна отмена')
assert(store.undo(), 'Отмена должна сработать')
assert(Math.abs(store.duration - 1) < 1e-6, 'После отмены длительность должна вернуться')

store.setGainDb(6)
assert(store.gainDb === 6, 'Ползунок громкости не сохранил значение')
assert(store.applyGain(), 'Усиление не применилось')
assert(store.undo(), 'Отмена усиления не сработала')

assert(store.applyFades(0.1), 'Fade не применился')
assert(Math.abs(store.duration - 1) < 1e-6, 'Fade не должен менять длительность')
assert(store.normalize(), 'Нормализация не применилась')

store.seek(0.5)
assert(Math.abs(store.playhead - 0.5) < 1e-6, 'Перемотка не изменила позицию')

store.setExportFormat('wav')
assert(store.activeFormat.id === 'wav', 'Формат экспорта не переключился')
assert(store.estimatedExportBytes === 8000 * 2 + 44, 'Неверная оценка размера WAV')

store.selectAll()
assert(!store.hasSelection, 'После «выделить всё» выделения быть не должно')

assert(snapshots.length > 3, 'Computed-значения не реагировали на изменения')

dispose()
store.dispose()

console.log('OK: стор записи работает как ожидается')
console.log(`Снимков реактивности: ${snapshots.length} · формат ${store.activeFormat.label}`)

// --- Тема оформления: проверяем, что переключение режимов обновляет DOM-класс. ---
const classList = new Set<string>()
const root = {
  classList: {
    toggle: (name: string, force: boolean) => {
      if (force) classList.add(name)
      else classList.delete(name)
    },
  },
  style: {} as Record<string, string>,
}
const listeners = new Set<() => void>()
let systemMatches = false
const globals = globalThis as unknown as Record<string, unknown>
globals.window = {
  localStorage: {
    value: null as string | null,
    getItem() {
      return this.value
    },
    setItem(_key: string, value: string) {
      this.value = value
    },
  },
  matchMedia: () => ({
    get matches() {
      return systemMatches
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }),
}
globals.document = { documentElement: root }

const { ThemeStore } = await import('../src/stores/themeStore')
const theme = new ThemeStore()

assert(theme.mode === 'system', 'Тема по умолчанию должна следовать системе')
assert(theme.resolvedMode === 'light', 'Светлая системная тема должна резолвиться в light')
assert(!classList.has('dark'), 'Класс dark не должен ставиться в светлой теме')

// Смена системной темы должна применяться без перезагрузки страницы.
systemMatches = true
listeners.forEach((listener) => listener())
assert(theme.resolvedMode === 'dark', 'Системная тёмная тема должна подхватываться')
assert(classList.has('dark'), 'При системной тёмной теме класс dark должен появляться')
systemMatches = false
listeners.forEach((listener) => listener())
assert(!classList.has('dark'), 'Возврат к светлой системной теме должен снимать класс dark')

theme.setMode('dark')
assert(theme.mode === 'dark', 'setMode должен менять режим')
assert(theme.isDark, 'isDark должен стать true')
assert(classList.has('dark'), 'В тёмной теме должен появляться класс dark')
assert(root.style.colorScheme === 'dark', 'color-scheme должен обновляться')

theme.toggle()
assert(theme.mode === 'light', 'toggle должен переключать на светлую тему')
assert(!classList.has('dark'), 'Класс dark должен сниматься')

theme.dispose()
console.log('OK: тема оформления переключается корректно')
