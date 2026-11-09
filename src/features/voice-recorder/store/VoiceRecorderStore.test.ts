// @vitest-environment jsdom
import { autorun, isObservable, runInAction } from 'mobx'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPcm, pcmDuration, pcmLength } from '../lib/pcm'
import { VoiceRecorderStore } from './VoiceRecorderStore'

// Скачивание файла — единственное, что требует реального DOM, поэтому мокаем его.
const { downloadBlob } = vi.hoisted(() => ({ downloadBlob: vi.fn() }))
vi.mock('@/lib/download', () => ({ downloadBlob }))

const sampleRate = 8000

/** Заполняет стор так, как это сделал бы stopRecording (без Web Audio API). */
function seed(store: VoiceRecorderStore, seconds = 1, amplitude = 0.5, channels = 1): void {
  const length = Math.round(sampleRate * seconds)
  const pcm = createPcm(sampleRate, channels, length)
  for (let i = 0; i < length; i += 1) {
    const value = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * amplitude
    for (const channel of pcm.channels) channel[i] = value
  }
  runInAction(() => {
    store.original = pcm
    store.pcm = pcm
    store.sourceMimeType = 'audio/webm;codecs=opus'
    store.selectionStart = 0
    store.selectionEnd = pcmDuration(pcm)
    store.status = 'ready'
  })
}

let store: VoiceRecorderStore

beforeEach(() => {
  downloadBlob.mockClear()
  store = new VoiceRecorderStore()
})

describe('состояние по умолчанию', () => {
  it('пустой стор ничего не умеет', () => {
    expect(store.hasAudio).toBe(false)
    expect(store.duration).toBe(0)
    expect(store.canUndo).toBe(false)
    expect(store.status).toBe('idle')
    expect(store.estimatedExportBytes).toBeNull()
    expect(store.peakDb).toBe(Number.NEGATIVE_INFINITY)
    expect(store.sourceFormatLabel).toBe('—')
  })

  it('в jsdom нет микрофона — запись недоступна', () => {
    expect(store.canRecord).toBe(false)
    expect(store.isBusy).toBe(false)
  })

  it('экспорт без записи возвращает null', async () => {
    await expect(store.exportAudio()).resolves.toBeNull()
  })
})

describe('загрузка записи', () => {
  it('хранит PCM без глубокой наблюдаемости', () => {
    seed(store)
    expect(isObservable(store.pcm)).toBe(false)
    expect(isObservable(store.pcm?.channels)).toBe(false)
  })

  it('считает длительность и подпись формата', () => {
    seed(store, 2)
    expect(store.duration).toBe(2)
    expect(store.hasAudio).toBe(true)
    expect(pcmLength(store.pcm!)).toBe(2 * sampleRate)

    runInAction(() => {
      store.sourceMimeType = 'audio/ogg;codecs=opus'
    })
    expect(store.sourceFormatLabel).toBe('OGG/Opus')

    runInAction(() => {
      store.sourceMimeType = 'audio/mp4'
    })
    expect(store.sourceFormatLabel).toBe('M4A/AAC')

    runInAction(() => {
      store.sourceMimeType = 'audio/wav'
    })
    expect(store.sourceFormatLabel).toBe('WAV')

    runInAction(() => {
      store.sourceMimeType = 'audio/flac'
    })
    expect(store.sourceFormatLabel).toBe('audio/flac')
  })

  it('вся запись не считается выделением', () => {
    seed(store)
    expect(store.hasSelection).toBe(false)
    expect(store.selectionDuration).toBe(1)
  })
})

describe('реактивность', () => {
  it('computed пересчитываются при правках', () => {
    seed(store)
    const snapshots: string[] = []
    const dispose = autorun(() => {
      snapshots.push(`${store.duration.toFixed(2)}:${store.canUndo ? 'undo' : '-'}`)
    })

    store.setSelection(0.25, 0.75)
    store.trimToSelection()
    store.undo()
    dispose()

    expect(snapshots[0]).toBe('1.00:-')
    expect(snapshots).toContain('0.50:undo')
    expect(snapshots.at(-1)).toBe('1.00:-')
  })
})

describe('выделение', () => {
  it('setSelection нормализует границы', () => {
    seed(store)
    store.setSelection(0.25, 0.75)
    expect(store.selectionStart).toBeCloseTo(0.25, 6)
    expect(store.selectionEnd).toBeCloseTo(0.75, 6)
    expect(store.hasSelection).toBe(true)
    expect(store.selectionDuration).toBeCloseTo(0.5, 6)

    // Обратный порядок аргументов должен меняться местами.
    store.setSelection(0.9, 0.1)
    expect(store.selectionStart).toBeCloseTo(0.1, 6)
    expect(store.selectionEnd).toBeCloseTo(0.9, 6)
  })

  it('слишком узкое выделение расширяется до минимума', () => {
    seed(store)
    store.setSelection(0.5, 0.5)
    expect(store.selectionDuration).toBeCloseTo(0.02, 6)
  })

  it('selectAll снимает выделение', () => {
    seed(store)
    store.setSelection(0.2, 0.4)
    store.selectAll()
    expect(store.hasSelection).toBe(false)
    expect(store.selectionEnd).toBe(1)
  })

  it('без записи выделение не меняется', () => {
    store.setSelection(0.2, 0.4)
    expect(store.selectionStart).toBe(0)
    expect(store.selectionEnd).toBe(0)
  })
})

describe('правки', () => {
  it('обрезка по выделению и отмена', () => {
    seed(store)
    store.setSelection(0.25, 0.75)
    expect(store.trimToSelection()).toBe(true)
    expect(store.duration).toBeCloseTo(0.5, 6)
    expect(store.canUndo).toBe(true)

    expect(store.undo()).toBe(true)
    expect(store.duration).toBeCloseTo(1, 6)
    expect(store.canUndo).toBe(false)
  })

  it('обрезка без выделения ничего не делает', () => {
    seed(store)
    expect(store.trimToSelection()).toBe(false)
    expect(store.canUndo).toBe(false)
  })

  it('усиление меняет пик и отменяется', () => {
    seed(store, 1, 0.2)
    const before = store.peakDb
    store.setGainDb(6)
    expect(store.applyGain()).toBe(true)
    expect(store.peakDb).toBeCloseTo(before + 6, 3)

    store.undo()
    expect(store.peakDb).toBeCloseTo(before, 6)
  })

  it('нулевое усиление не создаёт шаг истории', () => {
    seed(store)
    store.setGainDb(0)
    expect(store.applyGain()).toBe(false)
    expect(store.canUndo).toBe(false)
  })

  it('ползунки усиления и фейда ограничены разумными рамками', () => {
    store.setGainDb(100)
    expect(store.gainDb).toBe(24)
    store.setGainDb(-100)
    expect(store.gainDb).toBe(-24)

    store.setFadeSeconds(0)
    expect(store.fadeSeconds).toBe(0.05)
    store.setFadeSeconds(10)
    expect(store.fadeSeconds).toBe(5)
  })

  it('фейды не меняют длительность', () => {
    seed(store)
    expect(store.applyFades(0.1)).toBe(true)
    expect(store.duration).toBeCloseTo(1, 6)
    const data = store.pcm!.channels[0]
    expect(Math.abs(data[0])).toBeLessThan(0.01)
    expect(Math.abs(data[data.length - 1])).toBeLessThan(0.01)
  })

  it('нормализация поднимает пик до −1 дБ', () => {
    seed(store, 1, 0.1)
    expect(store.normalize()).toBe(true)
    expect(store.peakDb).toBeCloseTo(-1, 3)
  })

  it('удаление тишины срабатывает только при наличии тишины', () => {
    seed(store)
    expect(store.removeSilence()).toBe(false)

    const padded = createPcm(sampleRate, 1, sampleRate)
    for (let i = 0.4 * sampleRate; i < 0.6 * sampleRate; i += 1) {
      padded.channels[0][i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5
    }
    runInAction(() => {
      store.pcm = padded
      store.original = padded
      store.selectionEnd = pcmDuration(padded)
    })
    expect(store.removeSilence()).toBe(true)
    expect(store.duration).toBeLessThan(1)
  })

  it('история ограничена шестью шагами', () => {
    seed(store)
    for (let i = 0; i < 8; i += 1) store.applyGain(1)

    let undone = 0
    while (store.undo()) undone += 1
    expect(undone).toBe(6)
    expect(store.undo()).toBe(false)
  })

  it('сброс возвращает исходную запись', () => {
    seed(store)
    store.setSelection(0.25, 0.75)
    store.trimToSelection()
    store.resetToOriginal()
    expect(store.duration).toBeCloseTo(1, 6)
    expect(store.canUndo).toBe(false)
  })
})

describe('перемотка и проигрывание', () => {
  it('seek ограничивает позицию длительностью', () => {
    seed(store)
    store.seek(0.5)
    expect(store.playhead).toBeCloseTo(0.5, 6)
    store.seek(99)
    expect(store.playhead).toBeCloseTo(1, 6)
    store.seek(-5)
    expect(store.playhead).toBe(0)
  })

  it('seek без записи игнорируется', () => {
    store.seek(0.5)
    expect(store.playhead).toBe(0)
  })

  it('toggleLoop переключает зацикливание', () => {
    expect(store.loop).toBe(false)
    store.toggleLoop()
    expect(store.loop).toBe(true)
  })

  it('stopPlayback безопасен без активного источника', () => {
    expect(() => store.stopPlayback()).not.toThrow()
    expect(store.isPlaying).toBe(false)
  })
})

describe('экспорт', () => {
  it('форматы и оценка размера', () => {
    seed(store)
    expect(store.formats.map((format) => format.id)).toEqual(['wav', 'mp3'])

    store.setExportFormat('wav')
    expect(store.activeFormat.id).toBe('wav')
    expect(store.estimatedExportBytes).toBe(44 + 8000 * 2)

    store.setExportFormat('mp3')
    store.setMp3Bitrate(320)
    expect(store.activeFormat.id).toBe('mp3')
    expect(store.estimatedExportBytes).toBe(40_000)
    expect(store.mp3Bitrate).toBe(320)
  })

  it('неизвестный формат откатывается к первому доступному', () => {
    store.setExportFormat('nope')
    expect(store.activeFormat.id).toBe(store.formats[0].id)
  })

  it('экспорт в WAV скачивает файл с осмысленным именем', async () => {
    seed(store)
    store.setFileName('Мой клип?.wav')
    store.setExportFormat('wav')

    const outcome = await store.exportAudio()

    expect(outcome).toEqual({ fileName: 'Мой-клип.wav.wav', size: 44 + 8000 * 2 })
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    expect(store.isExporting).toBe(false)
    expect(store.exportProgress).toBeNull()
  })

  it('экспорт в MP3 отдаёт непустой файл', async () => {
    seed(store)
    store.setFileName('voice')
    store.setExportFormat('mp3')

    const outcome = await store.exportAudio()

    expect(outcome?.fileName).toBe('voice.mp3')
    expect(outcome?.size).toBeGreaterThan(0)
    expect(store.isExporting).toBe(false)
  })
})

describe('сброс и освобождение ресурсов', () => {
  it('discardRecording очищает состояние', () => {
    seed(store)
    store.discardRecording()
    expect(store.hasAudio).toBe(false)
    expect(store.original).toBeNull()
    expect(store.status).toBe('idle')
    expect(store.canUndo).toBe(false)
    expect(store.sourceMimeType).toBe('')
    expect(store.error).toBeNull()
  })

  it('startRecording без Web Audio API пишет ошибку в стор', async () => {
    await store.startRecording()
    expect(store.status).toBe('idle')
    expect(store.error).toContain('Web Audio API')
  })

  it('dispose не бросает исключений', () => {
    seed(store)
    expect(() => store.dispose()).not.toThrow()
  })
})
