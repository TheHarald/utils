/** mime-типы, которые нас устраивают при живой записи (от лучшего к худшему). */
const PREFERRED_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/webm',
  'audio/mp4',
]

export interface RecordingResult {
  blob: Blob
  mimeType: string
  durationMs: number
}

export interface LevelSnapshot {
  /** Пиковая амплитуда 0…1. */
  peak: number
  /** Среднеквадратичная амплитуда 0…1. */
  rms: number
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function' &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  )
}

export function pickRecordingMimeType(): string | undefined {
  if (typeof window === 'undefined' || typeof window.MediaRecorder?.isTypeSupported !== 'function') {
    return undefined
  }
  return PREFERRED_MIME_TYPES.find((type) => window.MediaRecorder.isTypeSupported(type))
}

function describeMediaStreamError(error: unknown): Error {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'SecurityError':
        return new Error(
          'Доступ к микрофону запрещён. Разрешите его в настройках браузера — запись работает только по HTTPS или на localhost.',
        )
      case 'NotFoundError':
      case 'OverconstrainedError':
        return new Error('Микрофон не найден. Подключите устройство записи и попробуйте снова.')
      case 'NotReadableError':
        return new Error('Микрофон занят другим приложением. Закройте его и попробуйте снова.')
      default:
        return new Error(`Не удалось получить доступ к микрофону (${error.name}).`)
    }
  }
  if (error instanceof Error) return error
  return new Error('Не удалось начать запись.')
}

/**
 * Обёртка над MediaRecorder: получение потока, пауза, остановка и метрики уровня.
 * Состояние интерфейса здесь не хранится — этим занимается VoiceRecorderStore.
 */
export class RecorderEngine {
  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private analyser: AnalyserNode | null = null
  private analyserBuffer: Float32Array<ArrayBuffer> | null = null
  private silentGain: GainNode | null = null
  private startedAt = 0
  private pausedAt = 0
  private pausedTotal = 0
  private mimeType = ''

  get isActive(): boolean {
    return this.recorder !== null
  }

  async start(context: AudioContext): Promise<void> {
    if (!isRecordingSupported()) {
      throw new Error('Этот браузер не поддерживает запись звука.')
    }
    if (this.recorder) return

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
    } catch (error) {
      throw describeMediaStreamError(error)
    }

    this.stream = stream
    const preferred = pickRecordingMimeType()
    this.recorder = preferred
      ? new MediaRecorder(stream, { mimeType: preferred })
      : new MediaRecorder(stream)
    this.mimeType = this.recorder.mimeType || preferred || 'audio/webm'

    this.chunks = []
    this.recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.chunks.push(event.data)
    })

    // Анализатор нужен только для индикатора уровня: сигнал в колонки не идёт.
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.4
    const silentGain = context.createGain()
    silentGain.gain.value = 0
    source.connect(analyser)
    analyser.connect(silentGain)
    silentGain.connect(context.destination)

    this.analyser = analyser
    this.silentGain = silentGain
    this.analyserBuffer = new Float32Array(analyser.fftSize)
    this.startedAt = performance.now()
    this.pausedAt = 0
    this.pausedTotal = 0

    this.recorder.start(200)
  }

  pause(): void {
    if (!this.recorder || this.recorder.state !== 'recording') return
    this.recorder.pause()
    this.pausedAt = performance.now()
  }

  resume(): void {
    if (!this.recorder || this.recorder.state !== 'paused') return
    this.recorder.resume()
    if (this.pausedAt > 0) {
      this.pausedTotal += performance.now() - this.pausedAt
      this.pausedAt = 0
    }
  }

  async stop(): Promise<RecordingResult> {
    const recorder = this.recorder
    if (!recorder) throw new Error('Запись не запущена')

    const durationMs = this.elapsedMs()
    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.addEventListener(
        'stop',
        () => resolve(new Blob(this.chunks, { type: this.mimeType })),
        { once: true },
      )
      recorder.addEventListener(
        'error',
        () => reject(new Error('Браузер прервал запись. Попробуйте ещё раз.')),
        { once: true },
      )
      if (recorder.state !== 'inactive') recorder.stop()
    })

    const result: RecordingResult = { blob, mimeType: this.mimeType, durationMs }
    this.release()
    return result
  }

  /** Сколько миллисекунд уже записано (время на паузе не учитывается). */
  elapsedMs(): number {
    if (this.startedAt === 0) return 0
    const now = performance.now()
    const currentPause = this.pausedAt > 0 ? now - this.pausedAt : 0
    return Math.max(0, now - this.startedAt - this.pausedTotal - currentPause)
  }

  getLevel(): LevelSnapshot {
    const analyser = this.analyser
    const buffer = this.analyserBuffer
    if (!analyser || !buffer) return { peak: 0, rms: 0 }

    analyser.getFloatTimeDomainData(buffer)
    let peak = 0
    let sum = 0
    for (let i = 0; i < buffer.length; i += 1) {
      const value = buffer[i]
      const absolute = Math.abs(value)
      if (absolute > peak) peak = absolute
      sum += value * value
    }
    return { peak, rms: Math.sqrt(sum / buffer.length) }
  }

  /** Принудительно освобождает микрофон (например, при уходе со страницы). */
  cancel(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop()
      } catch {
        /* уже остановлен */
      }
    }
    this.release()
  }

  private release(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.stream = null
    this.analyser?.disconnect()
    this.analyser = null
    this.silentGain?.disconnect()
    this.silentGain = null
    this.analyserBuffer = null
    this.recorder = null
    this.chunks = []
    this.startedAt = 0
    this.pausedAt = 0
    this.pausedTotal = 0
  }
}
