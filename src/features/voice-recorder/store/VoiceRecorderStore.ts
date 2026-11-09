import { computed, makeAutoObservable, observable, observableRef, runInAction } from 'mobx'
import { downloadBlob } from '@/lib/download'
import { clamp, dBToGain, defaultRecordingName, sanitizeFileName } from '@/lib/format'
import {
  applyGain as applyGainToPcm,
  fadePcm,
  normalizePcm,
  pcmPeakDb,
  trimPcm,
  trimSilence,
} from '../lib/audio-edit'
import {
  pcmDuration,
  pcmFromAudioBuffer,
  pcmLength,
  pcmToAudioBuffer,
  type PcmData,
} from '../lib/pcm'
import { encodeMp3, estimateMp3Bytes, type Mp3Bitrate } from '../lib/encoders/mp3'
import { encodeWav } from '../lib/encoders/wav'
import { encodeWithMediaRecorder } from '../lib/encoders/native'
import { EXPORT_FORMATS, findExportFormat, type ExportFormat } from '../lib/export-formats'
import { RecorderEngine, isRecordingSupported } from '../lib/recorder'

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'processing' | 'ready'

export interface ExportOutcome {
  fileName: string
  size: number
}

type VoiceRecorderPrivateKeys =
  | 'engine'
  | 'audioContext'
  | 'player'
  | 'history'
  | 'playRaf'
  | 'playStartTime'
  | 'playOffset'
  | 'playEnd'
  | 'meterRaf'
  | 'handlePlaybackEnded'
  | 'decodeRecording'
  | 'commit'
  | 'getAudioContext'
  | 'startMetering'
  | 'stopMetering'
  | 'startPlayheadLoop'
  | 'stopPlayheadLoop'

const MIN_SELECTION = 0.02
/** Сколько шагов отмены храним: каждый снимок — полная копия PCM. */
const HISTORY_LIMIT = 6

/**
 * Состояние инструмента «Запись голоса»: запись, проигрывание, правки и экспорт.
 * Аудиоданные хранятся как PcmData, поэтому монтаж работает без Web Audio API.
 */
export class VoiceRecorderStore {
  status: RecorderStatus = 'idle'
  elapsedMs = 0
  level = 0
  error: string | null = null

  /** Исходная запись (для сброса всех правок). */
  original: PcmData | null = null
  /** Текущее (возможно, отредактированное) аудио. */
  pcm: PcmData | null = null
  sourceMimeType = ''

  fileName = defaultRecordingName()
  exportFormat = 'mp3'
  mp3Bitrate: Mp3Bitrate = 192
  isExporting = false
  /** Прогресс 0…1 для форматов, которые кодируются в реальном времени. */
  exportProgress: number | null = null

  isPlaying = false
  playhead = 0
  loop = false
  selectionStart = 0
  selectionEnd = 0

  gainDb = 0
  fadeSeconds = 0.3

  private history: PcmData[] = []
  private engine = new RecorderEngine()
  private audioContext: AudioContext | null = null
  private player: AudioBufferSourceNode | null = null
  private playRaf: number | null = null
  private playStartTime = 0
  private playOffset = 0
  private playEnd = 0
  private meterRaf: number | null = null

  constructor() {
    makeAutoObservable<VoiceRecorderStore, VoiceRecorderPrivateKeys>(
      this,
      {
        status: observable,
        elapsedMs: observable,
        level: observable,
        error: observable,
        original: observableRef,
        pcm: observableRef,
        sourceMimeType: observable,
        fileName: observable,
        exportFormat: observable,
        mp3Bitrate: observable,
        isExporting: observable,
        exportProgress: observable,
        isPlaying: observable,
        playhead: observable,
        loop: observable,
        selectionStart: observable,
        selectionEnd: observable,
        gainDb: observable,
        fadeSeconds: observable,
        history: observableRef,
        duration: computed,
        hasAudio: computed,
        hasSelection: computed,
        selectionDuration: computed,
        canUndo: computed,
        formats: computed,
        activeFormat: computed,
        peakDb: computed,
        estimatedExportBytes: computed,
        isBusy: computed,
        canRecord: computed,
        sourceFormatLabel: computed,
        engine: false,
        audioContext: false,
        player: false,
        playRaf: false,
        playStartTime: false,
        playOffset: false,
        playEnd: false,
        meterRaf: false,
        handlePlaybackEnded: false,
        decodeRecording: false,
        commit: false,
        getAudioContext: false,
        startMetering: false,
        stopMetering: false,
        startPlayheadLoop: false,
        stopPlayheadLoop: false,
      },
      { autoBind: true },
    )
  }

  // ---------------------------------------------------------------- computed

  get duration(): number {
    return this.pcm ? pcmDuration(this.pcm) : 0
  }

  get hasAudio(): boolean {
    return this.pcm !== null && pcmLength(this.pcm) > 0
  }

  /** Есть ли выделение, отличное от всей записи. */
  get hasSelection(): boolean {
    return this.hasAudio && this.selectionEnd - this.selectionStart < this.duration - MIN_SELECTION
  }

  get selectionDuration(): number {
    return Math.max(0, this.selectionEnd - this.selectionStart)
  }

  get canUndo(): boolean {
    return this.history.length > 0
  }

  get formats(): ExportFormat[] {
    return EXPORT_FORMATS
  }

  get activeFormat(): ExportFormat {
    return findExportFormat(this.exportFormat) ?? EXPORT_FORMATS[0]
  }

  get peakDb(): number {
    return this.pcm ? pcmPeakDb(this.pcm) : -Infinity
  }

  get estimatedExportBytes(): number | null {
    const pcm = this.pcm
    if (!pcm) return null
    if (this.activeFormat.kind === 'mp3') return estimateMp3Bytes(pcm, this.mp3Bitrate)
    if (this.activeFormat.kind === 'wav') {
      return pcmLength(pcm) * Math.max(1, pcm.channels.length) * 2 + 44
    }
    return null
  }

  get isBusy(): boolean {
    return this.status === 'requesting' || this.status === 'processing'
  }

  get canRecord(): boolean {
    return isRecordingSupported()
  }

  get sourceFormatLabel(): string {
    const mime = this.sourceMimeType.toLowerCase()
    if (!mime) return '—'
    if (mime.includes('webm')) return 'WebM/Opus'
    if (mime.includes('ogg')) return 'OGG/Opus'
    if (mime.includes('mp4') || mime.includes('aac')) return 'M4A/AAC'
    if (mime.includes('wav')) return 'WAV'
    return this.sourceMimeType
  }

  // --------------------------------------------------------------- recording

  async startRecording(): Promise<void> {
    if (this.isBusy || this.status === 'recording') return
    this.error = null
    this.stopPlayback()
    this.status = 'requesting'

    try {
      const context = this.getAudioContext()
      await context.resume()
      // Если предыдущая запись не была корректно завершена, освобождаем микрофон.
      if (this.engine.isActive) this.engine.cancel()
      await this.engine.start(context)
      runInAction(() => {
        this.elapsedMs = 0
        this.level = 0
        this.status = 'recording'
        this.startMetering()
      })
    } catch (error) {
      this.engine.cancel()
      runInAction(() => {
        this.status = this.hasAudio ? 'ready' : 'idle'
        this.error = error instanceof Error ? error.message : 'Не удалось начать запись.'
      })
    }
  }

  pauseRecording(): void {
    if (this.status !== 'recording') return
    this.engine.pause()
    this.status = 'paused'
    this.level = 0
    this.elapsedMs = this.engine.elapsedMs()
  }

  resumeRecording(): void {
    if (this.status !== 'paused') return
    this.engine.resume()
    this.status = 'recording'
  }

  async stopRecording(): Promise<void> {
    if (this.status !== 'recording' && this.status !== 'paused') return
    this.status = 'processing'
    this.stopMetering()

    try {
      const result = await this.engine.stop()
      const context = this.getAudioContext()
      const buffer = await this.decodeRecording(context, result.blob)
      const pcm = pcmFromAudioBuffer(buffer)
      if (pcmLength(pcm) === 0) throw new Error('Запись получилась пустой — попробуйте ещё раз.')

      runInAction(() => {
        this.original = pcm
        this.pcm = pcm
        this.history = []
        this.sourceMimeType = result.mimeType
        this.selectionStart = 0
        this.selectionEnd = pcmDuration(pcm)
        this.playhead = 0
        this.elapsedMs = result.durationMs
        this.level = 0
        this.status = 'ready'
        this.error = null
      })
    } catch (error) {
      runInAction(() => {
        this.status = this.hasAudio ? 'ready' : 'idle'
        this.error =
          error instanceof Error
            ? error.message
            : 'Не удалось обработать запись. Попробуйте записать ещё раз.'
      })
    }
  }

  /** Полный сброс: остановить всё и удалить запись. */
  discardRecording(): void {
    this.engine.cancel()
    this.stopMetering()
    this.stopPlayback()
    this.original = null
    this.pcm = null
    this.history = []
    this.sourceMimeType = ''
    this.elapsedMs = 0
    this.level = 0
    this.playhead = 0
    this.selectionStart = 0
    this.selectionEnd = 0
    this.isExporting = false
    this.exportProgress = null
    this.fileName = defaultRecordingName()
    this.status = 'idle'
    this.error = null
  }

  /** Освобождает микрофон и звуковой контекст при уходе со страницы. */
  dispose(): void {
    this.engine.cancel()
    this.stopMetering()
    this.stopPlayback()
  }

  // ---------------------------------------------------------------- playback

  play(from?: number, to?: number): void {
    if (!this.hasAudio) return

    const context = this.getAudioContext()
    void context.resume()
    this.stopPlayback()

    const duration = this.duration
    let start = clamp(from ?? this.playhead, 0, duration)
    let end = clamp(to ?? duration, start, duration)
    if (end - start < MIN_SELECTION) {
      start = 0
      end = duration
    }
    if (end - start < MIN_SELECTION) return

    const source = context.createBufferSource()
    source.buffer = pcmToAudioBuffer(context, this.pcm as PcmData)
    source.connect(context.destination)
    source.addEventListener('ended', this.handlePlaybackEnded)

    this.player = source
    this.playStartTime = context.currentTime
    this.playOffset = start
    this.playEnd = end
    this.playhead = start
    this.isPlaying = true

    source.start(0, start, end - start)
    this.startPlayheadLoop()
  }

  playSelection(): void {
    if (!this.hasSelection) return
    this.play(this.selectionStart, this.selectionEnd)
  }

  togglePlayback(): void {
    if (this.isPlaying) {
      this.stopPlayback()
      return
    }
    if (!this.hasAudio) return
    if (this.hasSelection && this.playhead >= this.selectionEnd - MIN_SELECTION) {
      this.play(this.selectionStart, this.selectionEnd)
      return
    }
    this.play(this.playhead, this.duration)
  }

  stopPlayback(): void {
    const player = this.player
    if (player) {
      player.removeEventListener('ended', this.handlePlaybackEnded)
      try {
        player.stop()
      } catch {
        /* уже остановлен */
      }
      player.disconnect()
      this.player = null
    }
    this.stopPlayheadLoop()
    this.isPlaying = false
  }

  seek(seconds: number): void {
    if (!this.hasAudio) return
    const target = clamp(seconds, 0, this.duration)
    this.playhead = target
    if (this.isPlaying) {
      const end =
        this.hasSelection && target < this.selectionEnd ? this.selectionEnd : this.duration
      this.play(target, end)
    }
  }

  toggleLoop(): void {
    this.loop = !this.loop
  }

  private handlePlaybackEnded = (): void => {
    this.stopPlayheadLoop()
    runInAction(() => {
      this.player = null
      this.isPlaying = false
    })

    if (this.loop && this.hasAudio) {
      this.play(this.playOffset, this.playEnd)
    }
  }

  // --------------------------------------------------------------- selection

  setSelection(start: number, end: number): void {
    const duration = this.duration
    if (duration <= 0) return
    const from = clamp(Math.min(start, end), 0, duration)
    const to = clamp(Math.max(start, end), from, duration)
    this.selectionStart = from
    this.selectionEnd = Math.max(to, Math.min(duration, from + MIN_SELECTION))
  }

  selectAll(): void {
    this.selectionStart = 0
    this.selectionEnd = this.duration
  }

  // ----------------------------------------------------------------- editing

  private commit(next: PcmData): void {
    const previous = this.pcm
    if (!previous) return
    this.history = [...this.history, previous].slice(-HISTORY_LIMIT)
    this.pcm = next
    this.selectionStart = 0
    this.selectionEnd = pcmDuration(next)
    this.stopPlayback()
    this.playhead = 0
  }

  /** Обрезает запись по выделению. Возвращает false, если резать нечего. */
  trimToSelection(): boolean {
    const pcm = this.pcm
    if (!pcm || !this.hasSelection) return false
    const next = trimPcm(pcm, this.selectionStart, this.selectionEnd)
    if (pcmLength(next) === pcmLength(pcm)) return false
    this.commit(next)
    return true
  }

  normalize(): boolean {
    const pcm = this.pcm
    if (!pcm || !this.hasAudio) return false
    this.commit(normalizePcm(pcm, -1))
    return true
  }

  /** Применяет усиление в дБ; при нулевом значении ничего не делает. */
  applyGain(gainDb = this.gainDb): boolean {
    const pcm = this.pcm
    if (!pcm || !this.hasAudio) return false
    if (Math.abs(gainDb) < 0.05) return false
    this.commit(applyGainToPcm(pcm, dBToGain(gainDb)))
    return true
  }

  applyFades(seconds = this.fadeSeconds): boolean {
    const pcm = this.pcm
    if (!pcm || !this.hasAudio) return false
    const fade = clamp(seconds, 0.01, Math.max(0.01, this.duration / 2))
    this.commit(fadePcm(pcm, fade, fade))
    return true
  }

  removeSilence(): boolean {
    const pcm = this.pcm
    if (!pcm || !this.hasAudio) return false
    const next = trimSilence(pcm)
    if (pcmLength(next) === pcmLength(pcm)) return false
    this.commit(next)
    return true
  }

  undo(): boolean {
    const previous = this.history[this.history.length - 1]
    if (!previous) return false
    this.history = this.history.slice(0, -1)
    this.pcm = previous
    this.selectionStart = 0
    this.selectionEnd = pcmDuration(previous)
    this.stopPlayback()
    this.playhead = 0
    return true
  }

  resetToOriginal(): void {
    if (!this.original) return
    this.pcm = this.original
    this.history = []
    this.selectionStart = 0
    this.selectionEnd = pcmDuration(this.original)
    this.stopPlayback()
    this.playhead = 0
  }

  // ------------------------------------------------------------------ export

  setExportFormat(id: string): void {
    this.exportFormat = id
    this.exportProgress = null
  }

  setMp3Bitrate(bitrate: Mp3Bitrate): void {
    this.mp3Bitrate = bitrate
  }

  setFileName(value: string): void {
    this.fileName = value
  }

  setGainDb(value: number): void {
    this.gainDb = clamp(value, -24, 24)
  }

  setFadeSeconds(value: number): void {
    this.fadeSeconds = clamp(value, 0.05, 5)
  }

  async exportAudio(): Promise<ExportOutcome | null> {
    const pcm = this.pcm
    if (!pcm || !this.hasAudio) return null

    const format = this.activeFormat
    this.isExporting = true
    this.exportProgress = format.kind === 'native' ? 0 : null

    try {
      let blob: Blob
      let extension = format.extension

      // Даём React отрисовать состояние «Готовим файл…» перед синхронным кодированием.
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0)
      })

      if (format.kind === 'wav') {
        blob = encodeWav(pcm)
      } else if (format.kind === 'mp3') {
        blob = encodeMp3(pcm, this.mp3Bitrate)
      } else {
        if (!format.native) throw new Error('Этот формат недоступен в вашем браузере')
        const result = await encodeWithMediaRecorder(pcm, format.native, (progress) => {
          runInAction(() => {
            this.exportProgress = progress
          })
        })
        blob = result.blob
        extension = result.extension
      }

      if (blob.size === 0) throw new Error('Не удалось получить файл — запись пустая')

      const base = sanitizeFileName(this.fileName) || 'recording'
      const fileName = `${base}.${extension}`
      downloadBlob(blob, fileName)
      return { fileName, size: blob.size }
    } finally {
      runInAction(() => {
        this.isExporting = false
        this.exportProgress = null
      })
    }
  }

  // ---------------------------------------------------------------- internal

  private async decodeRecording(context: AudioContext, blob: Blob): Promise<AudioBuffer> {
    const bytes = await blob.arrayBuffer()
    return await new Promise<AudioBuffer>((resolve, reject) => {
      // Колбэк-форма работает и в старых Safari, и в современных браузерах.
      context.decodeAudioData(bytes, resolve, () =>
        reject(new Error('Браузер не смог прочитать запись. Попробуйте ещё раз.')),
      )
    })
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextCtor =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextCtor) throw new Error('Браузер не поддерживает Web Audio API.')
      this.audioContext = new AudioContextCtor()
    }
    return this.audioContext
  }

  private startMetering(): void {
    this.stopMetering()
    const tick = () => {
      if (this.status !== 'recording' && this.status !== 'paused') {
        this.meterRaf = null
        return
      }
      if (this.status === 'recording') {
        const level = this.engine.getLevel().peak
        const elapsed = this.engine.elapsedMs()
        // rAF-колбэк не является action — изменения оборачиваем в runInAction.
        runInAction(() => {
          this.level = level
          // Обновляем таймер не чаще ~20 раз в секунду, чтобы не гонять рендер.
          if (elapsed - this.elapsedMs >= 50) this.elapsedMs = elapsed
        })
      }
      this.meterRaf = window.requestAnimationFrame(tick)
    }
    this.meterRaf = window.requestAnimationFrame(tick)
  }

  private stopMetering(): void {
    if (this.meterRaf !== null) {
      window.cancelAnimationFrame(this.meterRaf)
      this.meterRaf = null
    }
    this.level = 0
  }

  private startPlayheadLoop(): void {
    this.stopPlayheadLoop()
    const tick = () => {
      const context = this.audioContext
      if (!this.isPlaying || !context) {
        this.playRaf = null
        return
      }
      const next = Math.min(
        this.playOffset + (context.currentTime - this.playStartTime),
        this.playEnd,
      )
      runInAction(() => {
        this.playhead = next
      })
      this.playRaf = window.requestAnimationFrame(tick)
    }
    this.playRaf = window.requestAnimationFrame(tick)
  }

  private stopPlayheadLoop(): void {
    if (this.playRaf !== null) {
      window.cancelAnimationFrame(this.playRaf)
      this.playRaf = null
    }
  }
}




