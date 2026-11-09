import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { VideoAsset } from '../lib/assets'
import type { VideoExportOptions, VideoExportResult } from '../lib/export-video'
import { VideoEditorStore } from './VideoEditorStore'

// Медиа и скачивание — единственное, что требует реального DOM и кодека.
const { prepareVideo, releaseVideoUrl, downloadBlob, exportTimelineVideo } = vi.hoisted(() => ({
  prepareVideo: vi.fn<(file: File, id: string) => Promise<VideoAsset>>(),
  releaseVideoUrl: vi.fn<(url: string) => void>(),
  downloadBlob: vi.fn<(blob: Blob, fileName: string) => void>(),
  exportTimelineVideo: vi.fn<(options: VideoExportOptions) => Promise<VideoExportResult>>(),
}))

vi.mock('../lib/media', () => ({
  isVideoImportSupported: () => true,
  prepareVideo,
  releaseVideoUrl,
}))

vi.mock('../lib/export-video', () => ({
  isVideoExportSupported: () => true,
  pickExportMimeType: () => 'video/webm',
  exportTimelineVideo,
}))

vi.mock('@/lib/download', () => ({ downloadBlob }))

function makeFile(name: string, type = 'video/mp4'): File {
  return { name, type, size: 2048 } as unknown as File
}

/** Заглушка чтения метаданных: `long` — 10 с, `short` — 4 с. */
function mockPrepare(): void {
  prepareVideo.mockImplementation(async (file, id) => ({
    id,
    name: file.name,
    url: `blob:${id}`,
    duration: file.name.startsWith('short') ? 4 : 10,
    width: 1280,
    height: 720,
    size: file.size,
  }))
}

function makeExportResult(): VideoExportResult {
  return {
    blob: new Blob(['video'], { type: 'video/webm' }),
    extension: 'webm',
    mimeType: 'video/webm',
    width: 1280,
    height: 720,
  }
}

/** Импортирует два файла: фрагменты 10 с и 4 с. */
async function seed(store: VideoEditorStore): Promise<void> {
  mockPrepare()
  await store.importFiles([makeFile('long.mp4'), makeFile('short.mp4')])
}

let store: VideoEditorStore

beforeEach(() => {
  store = new VideoEditorStore()
})

describe('состояние по умолчанию', () => {
  it('пустой стор ничего не умеет', () => {
    expect(store.hasClips).toBe(false)
    expect(store.duration).toBe(0)
    expect(store.status).toBe('idle')
    expect(store.selectedClipId).toBeNull()
    expect(store.currentPosition).toBeNull()
    expect(store.estimatedExportBytes).toBeNull()
    expect(store.fileName).toMatch(/^video-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}$/)
  })

  it('держит настройки экспорта по умолчанию', () => {
    expect(store.exportHeight).toBe(720)
    expect(store.exportFps).toBe(30)
    expect(store.includeAudio).toBe(true)
    expect(store.exportExtension).toBe('webm')
    expect(store.exportSupported).toBe(true)
    expect(store.canImport).toBe(true)
    expect(store.isBusy).toBe(false)
  })

  it('без фрагментов не запускает проигрывание и экспорт', async () => {
    store.play()
    expect(store.isPlaying).toBe(false)
    await expect(store.exportVideo()).resolves.toBeNull()
  })
})

describe('импорт файлов', () => {
  it('добавляет файлы и фрагменты на шкалу', async () => {
    mockPrepare()
    const outcome = await store.importFiles([makeFile('long.mp4'), makeFile('short.mp4')])

    expect(outcome.failed).toEqual([])
    expect(outcome.added).toHaveLength(2)
    expect(store.assetCount).toBe(2)
    expect(store.clips).toHaveLength(2)
    expect(store.status).toBe('ready')
    expect(store.duration).toBe(14)
    expect(store.selectedClipId).toBe(store.clips[0].id)
    expect(store.assets[0].url).toMatch(/^blob:asset-/)
    expect(store.clips[1].end).toBe(4)
  })

  it('отклоняет не видеофайлы, не прерывая импорт', async () => {
    const outcome = await store.importFiles([makeFile('notes.txt', 'text/plain')])

    expect(outcome.added).toHaveLength(0)
    expect(outcome.failed).toEqual([{ name: 'notes.txt', reason: 'Это не видеофайл' }])
    expect(prepareVideo).not.toHaveBeenCalled()
    expect(store.clips).toHaveLength(0)
    expect(store.status).toBe('idle')
    expect(store.error).toContain('notes.txt')
  })

  it('сохраняет остальные файлы, если один не открылся', async () => {
    prepareVideo
      .mockRejectedValueOnce(new Error('формат не поддерживается'))
      .mockImplementationOnce(async (file, id) => ({
        id,
        name: file.name,
        url: `blob:${id}`,
        duration: 10,
        width: 1280,
        height: 720,
        size: file.size,
      }))

    const outcome = await store.importFiles([makeFile('bad.avi'), makeFile('good.mp4')])

    expect(outcome.added).toHaveLength(1)
    expect(outcome.failed).toEqual([{ name: 'bad.avi', reason: 'формат не поддерживается' }])
    expect(store.clips).toHaveLength(1)
    expect(store.error).toContain('bad.avi')
  })

  it('с пустым списком ничего не делает', async () => {
    const outcome = await store.importFiles([])
    expect(outcome).toEqual({ added: [], failed: [] })
    expect(store.status).toBe('idle')
    expect(store.error).toBeNull()
  })
})

describe('монтаж', () => {
  it('режет фрагмент под курсором', async () => {
    await seed(store)
    const first = store.clips[0]

    store.seek(5)
    expect(store.canSplitAtPlayhead).toBe(true)
    expect(store.splitAtPlayhead()).toBe(true)

    expect(store.clips).toHaveLength(3)
    expect(store.duration).toBe(14)
    expect(store.playhead).toBe(5)
    expect(store.clips[0]).toMatchObject({ id: first.id, start: 0, end: 5 })
    expect(store.clips[1]).toMatchObject({ assetId: first.assetId, start: 5, end: 10 })
    expect(store.selectedClipId).toBe(store.clips[1].id)
  })

  it('не режет на самом краю', async () => {
    await seed(store)

    store.seek(0)
    expect(store.canSplitAtPlayhead).toBe(false)
    expect(store.splitAtPlayhead()).toBe(false)

    store.seek(store.duration)
    expect(store.splitAtPlayhead()).toBe(false)
    expect(store.clips).toHaveLength(2)
  })

  it('меняет порядок фрагментов и следит за границами списка', async () => {
    await seed(store)
    const [firstId, secondId] = store.clips.map((clip) => clip.id)

    store.selectClip(firstId)
    expect(store.canMoveLeft).toBe(false)
    expect(store.canMoveRight).toBe(true)
    expect(store.moveSelected(-1)).toBe(false)
    expect(store.moveSelected(1)).toBe(true)

    expect(store.clips.map((clip) => clip.id)).toEqual([secondId, firstId])
    expect(store.selectedClipIndex).toBe(1)
    expect(store.canMoveRight).toBe(false)
    expect(store.moveSelected(1)).toBe(false)
  })

  it('обрезает фрагмент и возвращает исходные границы', async () => {
    await seed(store)
    const clipId = store.clips[0].id

    store.setClipRange(clipId, 2, 6)
    expect(store.clips[0]).toMatchObject({ start: 2, end: 6 })
    expect(store.duration).toBe(8)
    expect(store.selectedClipId).toBe(clipId)

    store.setClipRange(clipId, 8, 50)
    expect(store.clips[0]).toMatchObject({ start: 8, end: 10 })

    store.resetClipRange(clipId)
    expect(store.clips[0]).toMatchObject({ start: 0, end: 10 })
    expect(store.duration).toBe(14)
  })

  it('освобождает файл, когда последний фрагмент с ним удалён', async () => {
    await seed(store)
    const asset = store.assets[0]

    store.removeClip(store.clips[0].id)
    expect(store.clips).toHaveLength(1)
    expect(store.assets).toHaveLength(1)
    expect(releaseVideoUrl).toHaveBeenCalledWith(asset.url)
    expect(store.duration).toBe(4)
  })

  it('оставляет файл, если он ещё нужен другому фрагменту', async () => {
    await seed(store)
    const asset = store.assets[0]

    expect(store.appendAsset(asset.id)).toBe(true)
    expect(store.appendAsset('asset-missing')).toBe(false)
    expect(store.clips).toHaveLength(3)

    store.removeClip(store.clips[0].id)
    expect(releaseVideoUrl).not.toHaveBeenCalled()

    const rest = store.clips.find((clip) => clip.assetId === asset.id)
    store.removeClip(rest?.id ?? '')
    expect(releaseVideoUrl).toHaveBeenCalledWith(asset.url)
  })
})

describe('проигрывание', () => {
  it('держит курсор внутри шкалы', async () => {
    await seed(store)

    store.seek(-5)
    expect(store.playhead).toBe(0)
    store.seek(999)
    expect(store.playhead).toBe(14)
    store.seek(Number.NaN)
    expect(store.playhead).toBe(0)
  })

  it('переключает паузу и начинает с начала в конце шкалы', async () => {
    await seed(store)

    store.togglePlayback()
    expect(store.isPlaying).toBe(true)
    store.togglePlayback()
    expect(store.isPlaying).toBe(false)

    store.seek(store.duration)
    store.play()
    expect(store.playhead).toBe(0)
    expect(store.isPlaying).toBe(true)

    store.stop()
    expect(store.isPlaying).toBe(false)
    expect(store.playhead).toBe(0)
  })

  it('показывает текущий фрагмент', async () => {
    await seed(store)

    store.seek(11)
    expect(store.currentPosition).toMatchObject({ index: 1, localTime: 1 })
    expect(store.currentClip?.assetId).toBe(store.clips[1].assetId)
  })
})


describe('экспорт', () => {
  it('скачивает файл с расширением из mime-типа', async () => {
    await seed(store)
    exportTimelineVideo.mockResolvedValue(makeExportResult())

    store.setFileName('  Мой ролик  ')
    const outcome = await store.exportVideo()

    expect(outcome).toEqual({ fileName: 'Мой-ролик.webm', size: 5 })
    expect(downloadBlob).toHaveBeenCalledTimes(1)
    expect(downloadBlob.mock.calls[0][1]).toBe('Мой-ролик.webm')
    expect(exportTimelineVideo.mock.calls[0][0]).toMatchObject({
      height: 720,
      fps: 30,
      includeAudio: true,
    })
    expect(exportTimelineVideo.mock.calls[0][0].clips).toHaveLength(2)
    expect(store.isExporting).toBe(false)
    expect(store.exportProgress).toBeNull()
    expect(store.error).toBeNull()
  })

  it('показывает прогресс и блокирует правки до конца записи', async () => {
    await seed(store)

    let report: ((value: number) => void) | undefined
    let finish: ((value: VideoExportResult) => void) | undefined
    exportTimelineVideo.mockImplementation((options) => {
      report = options.onProgress
      return new Promise<VideoExportResult>((resolve) => {
        finish = resolve
      })
    })

    const pending = store.exportVideo()
    expect(store.isExporting).toBe(true)
    expect(store.exportProgress).toBe(0)
    expect(store.isBusy).toBe(true)
    expect(store.canImport).toBe(false)

    report?.(0.42)
    expect(store.exportProgress).toBeCloseTo(0.42)
    // Во время экспорта второй запуск и импорт не начинаются.
    await expect(store.exportVideo()).resolves.toBeNull()
    await expect(store.importFiles([makeFile('late.mp4')])).resolves.toEqual({
      added: [],
      failed: [],
    })
    expect(store.error).toContain('экспорт')

    finish?.(makeExportResult())
    await pending

    expect(store.isExporting).toBe(false)
    expect(store.exportProgress).toBeNull()
    expect(downloadBlob).toHaveBeenCalledTimes(1)
  })

  it('показывает ошибку записи и не скачивает пустой файл', async () => {
    await seed(store)
    exportTimelineVideo.mockRejectedValue(new Error('Браузер прервал запись'))

    await expect(store.exportVideo()).rejects.toThrow('Браузер прервал запись')

    expect(store.error).toBe('Браузер прервал запись')
    expect(store.isExporting).toBe(false)
    expect(store.exportProgress).toBeNull()
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('отменяет запись через AbortSignal', async () => {
    await seed(store)
    let signal: AbortSignal | undefined
    exportTimelineVideo.mockImplementation((options) => {
      signal = options.signal
      return new Promise<VideoExportResult>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('Экспорт отменён')))
      })
    })

    const pending = store.exportVideo()
    store.cancelExport()
    await expect(pending).rejects.toThrow('Экспорт отменён')
    expect(signal?.aborted).toBe(true)
    expect(store.error).toBe('Экспорт отменён')
    expect(store.isExporting).toBe(false)
  })
})

describe('освобождение ресурсов', () => {
  it('dispose очищает шкалу и освобождает файлы', async () => {
    await seed(store)
    const urls = store.assets.map((asset) => asset.url)

    store.dispose()

    expect(releaseVideoUrl).toHaveBeenCalledTimes(urls.length)
    for (const url of urls) expect(releaseVideoUrl).toHaveBeenCalledWith(url)
    expect(store.assets).toHaveLength(0)
    expect(store.clips).toHaveLength(0)
    expect(store.selectedClipId).toBeNull()
    expect(store.playhead).toBe(0)
    expect(store.status).toBe('idle')
  })
})

