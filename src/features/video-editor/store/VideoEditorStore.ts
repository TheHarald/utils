import { computed, makeAutoObservable, observable, observableRef, runInAction } from 'mobx'
import { downloadBlob } from '@/lib/download'
import { clamp, sanitizeFileName, timestampSuffix } from '@/lib/format'
import { isVideoFile, type VideoAsset } from '../lib/assets'
import {
  EXPORT_FPS,
  EXPORT_HEIGHTS,
  estimateVideoBytes,
  fitExportSize,
  mimeExtension,
  type ExportFps,
  type ExportHeight,
} from '../lib/export-settings'
import {
  exportTimelineVideo,
  isVideoExportSupported,
  pickExportMimeType,
} from '../lib/export-video'
import { isVideoImportSupported, prepareVideo, releaseVideoUrl } from '../lib/media'
import {
  MIN_CLIP_DURATION,
  clipDuration,
  clipOffset,
  createClip,
  findClipIndex,
  locateTime,
  moveClip,
  removeClip as removeClipAt,
  splitClip,
  timelineDuration,
  trimClip,
  type TimelinePosition,
  type VideoClip,
} from '../lib/timeline'

export type VideoEditorStatus = 'idle' | 'importing' | 'ready'

export interface VideoImportFailure {
  name: string
  reason: string
}

export interface VideoImportOutcome {
  added: VideoAsset[]
  failed: VideoImportFailure[]
}

export interface VideoExportOutcome {
  fileName: string
  size: number
}

type VideoEditorPrivateKeys = 'abortController'

let idCounter = 0

/** Локальные id: живут только в рамках вкладки и не требуют crypto.randomUUID. */
function createId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

export function defaultVideoName(): string {
  return `video-${timestampSuffix()}`
}

/**
 * Состояние инструмента «Редактор видео»: импорт файлов, шкала фрагментов,
 * предпросмотр и экспорт в WebM/MP4 средствами браузера.
 * Видео не покидает устройство: object URL + canvas + MediaRecorder.
 */
export class VideoEditorStore {
  status: VideoEditorStatus = 'idle'
  error: string | null = null

  assets: VideoAsset[] = []
  clips: VideoClip[] = []
  selectedClipId: string | null = null

  isPlaying = false
  playhead = 0

  fileName = defaultVideoName()
  exportHeight: ExportHeight = 720
  exportFps: ExportFps = 30
  includeAudio = true
  isExporting = false
  /** Прогресс 0…1 — экспорт идёт в реальном времени. */
  exportProgress: number | null = null

  private abortController: AbortController | null = null

  constructor() {
    makeAutoObservable<VideoEditorStore, VideoEditorPrivateKeys>(
      this,
      {
        status: observable,
        error: observable,
        assets: observableRef,
        clips: observableRef,
        selectedClipId: observable,
        isPlaying: observable,
        playhead: observable,
        fileName: observable,
        exportHeight: observable,
        exportFps: observable,
        includeAudio: observable,
        isExporting: observable,
        exportProgress: observable,
        abortController: false,
        hasClips: computed,
        assetCount: computed,
        duration: computed,
        isBusy: computed,
        canImport: computed,
        exportSupported: computed,
        exportMimeType: computed,
        exportExtension: computed,
        exportSize: computed,
        estimatedExportBytes: computed,
        exportHeights: computed,
        exportFpsOptions: computed,
        currentPosition: computed,
        currentClip: computed,
        selectedClip: computed,
        selectedClipIndex: computed,
        selectedAsset: computed,
        canSplitAtPlayhead: computed,
        canMoveLeft: computed,
        canMoveRight: computed,
      },
      { autoBind: true },
    )
  }

  // ---------------------------------------------------------------- computed

  get hasClips(): boolean {
    return this.clips.length > 0
  }

  get assetCount(): number {
    return this.assets.length
  }

  get duration(): number {
    return timelineDuration(this.clips)
  }

  get isBusy(): boolean {
    return this.status === 'importing' || this.isExporting
  }

  get canImport(): boolean {
    return isVideoImportSupported() && !this.isBusy
  }

  get exportSupported(): boolean {
    return isVideoExportSupported()
  }

  get exportMimeType(): string | null {
    return pickExportMimeType()
  }

  get exportExtension(): 'mp4' | 'webm' {
    return this.exportMimeType ? mimeExtension(this.exportMimeType) : 'webm'
  }

  /** Итоговый кадр: пропорции берём у первого фрагмента, высоту — из настроек. */
  get exportSize() {
    const firstClip = this.clips[0]
    const asset = firstClip
      ? this.assets.find((item) => item.id === firstClip.assetId)
      : undefined
    return fitExportSize(asset?.width ?? 0, asset?.height ?? 0, this.exportHeight)
  }

  get estimatedExportBytes(): number | null {
    if (!this.hasClips) return null
    const { width, height } = this.exportSize
    return estimateVideoBytes(this.duration, width, height, this.exportFps, this.includeAudio)
  }

  get exportHeights(): readonly ExportHeight[] {
    return EXPORT_HEIGHTS
  }

  get exportFpsOptions(): readonly ExportFps[] {
    return EXPORT_FPS
  }

  get currentPosition(): TimelinePosition | null {
    return locateTime(this.clips, this.playhead)
  }

  get currentClip(): VideoClip | null {
    return this.currentPosition?.clip ?? null
  }

  get selectedClip(): VideoClip | null {
    return this.clips.find((clip) => clip.id === this.selectedClipId) ?? null
  }

  get selectedClipIndex(): number {
    return findClipIndex(this.clips, this.selectedClipId)
  }

  get selectedAsset(): VideoAsset | null {
    const clip = this.selectedClip
    if (!clip) return null
    return this.assets.find((asset) => asset.id === clip.assetId) ?? null
  }

  get canSplitAtPlayhead(): boolean {
    const position = this.currentPosition
    if (!position) return false
    return (
      position.localTime >= MIN_CLIP_DURATION &&
      clipDuration(position.clip) - position.localTime >= MIN_CLIP_DURATION
    )
  }

  get canMoveLeft(): boolean {
    return this.selectedClipIndex > 0
  }

  get canMoveRight(): boolean {
    return this.selectedClipIndex >= 0 && this.selectedClipIndex < this.clips.length - 1
  }

  // ------------------------------------------------------------------ импорт

  /** Добавляет видеофайлы в конец шкалы. Ошибки по файлам не прерывают импорт. */
  async importFiles(files: File[]): Promise<VideoImportOutcome> {
    const added: VideoAsset[] = []
    const failed: VideoImportFailure[] = []

    if (files.length === 0) return { added, failed }
    if (this.isExporting) {
      this.error = 'Дождитесь окончания экспорта — импорт временно недоступен'
      return { added, failed }
    }

    runInAction(() => {
      this.status = 'importing'
      this.error = null
    })

    try {
      for (const file of files) {
        if (!isVideoFile(file)) {
          failed.push({ name: file.name, reason: 'Это не видеофайл' })
          continue
        }
        try {
          added.push(await prepareVideo(file, createId('asset')))
        } catch (error) {
          failed.push({
            name: file.name,
            reason: error instanceof Error ? error.message : 'Не удалось открыть файл',
          })
        }
      }
    } finally {
      runInAction(() => {
        const newClips = added.map((asset) =>
          createClip(createId('clip'), asset.id, asset.duration),
        )
        this.assets = [...this.assets, ...added]
        this.clips = [...this.clips, ...newClips]
        if (!this.selectedClipId && newClips[0]) this.selectedClipId = newClips[0].id
        this.status = this.clips.length > 0 ? 'ready' : 'idle'
        if (failed.length > 0) {
          this.error = failed.map((item) => `«${item.name}»: ${item.reason}`).join(' ')
        }
      })
    }

    return { added, failed }
  }

  /** Добавляет ещё один фрагмент из уже импортированного файла. */
  appendAsset(assetId: string): boolean {
    const asset = this.assets.find((item) => item.id === assetId)
    if (!asset) return false

    const clip = createClip(createId('clip'), asset.id, asset.duration)
    this.clips = [...this.clips, clip]
    this.selectedClipId = clip.id
    this.pause()
    this.seek(clipOffset(this.clips, this.clips.length - 1))
    return true
  }

  // ------------------------------------------------------------------ монтаж

  selectClip(id: string | null): void {
    this.selectedClipId = id
    const index = findClipIndex(this.clips, id)
    if (index < 0) return
    this.pause()
    this.seek(clipOffset(this.clips, index))
  }

  /** Меняет границы фрагмента; исходный файл и минимальная длина — жёсткие ограничения. */
  setClipRange(id: string, start: number, end: number): void {
    const index = findClipIndex(this.clips, id)
    if (index < 0) return

    const clip = this.clips[index]
    const asset = this.assets.find((item) => item.id === clip.assetId)
    const next = [...this.clips]
    next[index] = trimClip(clip, start, end, asset?.duration ?? Number.POSITIVE_INFINITY)
    this.clips = next

    this.pause()
    this.selectedClipId = id
    this.seek(Math.min(this.playhead, this.duration))
  }

  resetClipRange(id: string): void {
    const clip = this.clips.find((item) => item.id === id)
    if (!clip) return
    const asset = this.assets.find((item) => item.id === clip.assetId)
    if (!asset) return
    this.setClipRange(id, 0, asset.duration)
  }

  /** Делит фрагмент под курсором на два. */
  splitAtPlayhead(): boolean {
    const position = this.currentPosition
    if (!position) return false

    const next = splitClip(this.clips, position.index, position.localTime, createId('clip'))
    if (!next) return false

    this.clips = next
    this.selectedClipId = next[position.index + 1]?.id ?? null
    this.pause()
    this.seek(position.offset + position.localTime)
    return true
  }

  moveSelected(direction: -1 | 1): boolean {
    const index = this.selectedClipIndex
    if (index < 0) return false

    const next = moveClip(this.clips, index, direction)
    if (next === this.clips) return false

    this.clips = next
    this.pause()
    this.seek(clipOffset(this.clips, index + direction))
    return true
  }

  /** Удаляет фрагмент; файл освобождается, если на него больше ничего не ссылается. */
  removeClip(id: string): void {
    const index = findClipIndex(this.clips, id)
    if (index < 0) return

    const removed = this.clips[index]
    this.clips = removeClipAt(this.clips, index)

    if (!this.clips.some((clip) => clip.assetId === removed.assetId)) {
      const asset = this.assets.find((item) => item.id === removed.assetId)
      if (asset) {
        releaseVideoUrl(asset.url)
        this.assets = this.assets.filter((item) => item.id !== asset.id)
      }
    }

    if (this.selectedClipId === id) {
      this.selectedClipId = this.clips[Math.min(index, this.clips.length - 1)]?.id ?? null
    }

    this.pause()
    this.seek(Math.min(this.playhead, this.duration))
  }


  // ------------------------------------------------------------- проигрывание

  seek(time: number): void {
    const duration = this.duration
    this.playhead = Number.isFinite(time) ? clamp(time, 0, duration) : 0
  }

  play(): void {
    if (!this.hasClips || this.isExporting) return
    if (this.playhead >= this.duration - 0.01) this.playhead = 0
    this.isPlaying = true
  }

  pause(): void {
    this.isPlaying = false
  }

  togglePlayback(): void {
    if (this.isPlaying) this.pause()
    else this.play()
  }

  stop(): void {
    this.pause()
    this.playhead = 0
  }

  // ------------------------------------------------------------------ экспорт

  setFileName(value: string): void {
    this.fileName = value
  }

  setExportHeight(value: ExportHeight): void {
    this.exportHeight = value
  }

  setExportFps(value: ExportFps): void {
    this.exportFps = value
  }

  setIncludeAudio(value: boolean): void {
    this.includeAudio = value
  }

  cancelExport(): void {
    this.abortController?.abort()
  }

  /** Собирает и скачивает ролик; возвращает null, если собирать нечего. */
  async exportVideo(): Promise<VideoExportOutcome | null> {
    if (!this.hasClips || this.isExporting) return null
    if (!this.exportSupported) {
      throw new Error('Браузер не умеет записывать видео из canvas — попробуйте Chrome или Firefox')
    }

    const controller = new AbortController()
    this.abortController = controller
    this.isExporting = true
    this.exportProgress = 0
    this.error = null
    this.pause()

    try {
      const result = await exportTimelineVideo({
        clips: this.clips.map((clip) => ({ ...clip })),
        assets: this.assets.map((asset) => ({ ...asset })),
        height: this.exportHeight,
        fps: this.exportFps,
        includeAudio: this.includeAudio,
        signal: controller.signal,
        onProgress: (progress) => {
          runInAction(() => {
            this.exportProgress = clamp(progress, 0, 1)
          })
        },
      })

      const base = sanitizeFileName(this.fileName) || 'video'
      const fileName = `${base}.${result.extension}`
      downloadBlob(result.blob, fileName)
      return { fileName, size: result.blob.size }
    } catch (error) {
      runInAction(() => {
        this.error =
          error instanceof Error ? error.message : 'Не удалось экспортировать видео'
      })
      throw error
    } finally {
      runInAction(() => {
        this.isExporting = false
        this.exportProgress = null
        this.abortController = null
      })
    }
  }

  /** Останавливает проигрывание и освобождает object URL. */
  dispose(): void {
    this.abortController?.abort()
    this.pause()
    for (const asset of this.assets) releaseVideoUrl(asset.url)
    this.assets = []
    this.clips = []
    this.selectedClipId = null
    this.playhead = 0
    this.status = 'idle'
    this.exportProgress = null
  }
}
