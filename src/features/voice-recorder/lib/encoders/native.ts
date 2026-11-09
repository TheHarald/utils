import { pcmDuration, pcmLength, type PcmData } from '../pcm'

export interface NativeFormat {
  id: 'webm' | 'ogg' | 'm4a'
  label: string
  description: string
  extension: string
  /** Кандидаты mime-типов в порядке предпочтения. */
  mimeTypes: string[]
}

export interface NativeEncodeResult {
  blob: Blob
  mimeType: string
  extension: string
}

/**
 * Форматы, которые умеет писать MediaRecorder в текущем браузере.
 * Порядок — от самого «лёгкого» (Opus) к AAC.
 */
const CANDIDATE_FORMATS: NativeFormat[] = [
  {
    id: 'webm',
    label: 'WebM (Opus)',
    description: 'Компактный формат, по умолчанию в Chrome и Firefox',
    extension: 'webm',
    mimeTypes: ['audio/webm;codecs=opus', 'audio/webm'],
  },
  {
    id: 'ogg',
    label: 'OGG (Opus)',
    description: 'Открытый формат, хорошо подходит для веба',
    extension: 'ogg',
    mimeTypes: ['audio/ogg;codecs=opus', 'audio/ogg'],
  },
  {
    id: 'm4a',
    label: 'M4A (AAC)',
    description: 'Нативный формат для Safari и экосистемы Apple',
    extension: 'm4a',
    mimeTypes: ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac'],
  },
]

export function isMediaRecorderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof window.MediaRecorder.isTypeSupported === 'function'
  )
}

function pickMimeType(format: NativeFormat): string | null {
  if (!isMediaRecorderSupported()) return null
  return format.mimeTypes.find((type) => window.MediaRecorder.isTypeSupported(type)) ?? null
}

/** Список форматов, реально доступных в текущем браузере. */
export function getSupportedNativeFormats(): NativeFormat[] {
  return CANDIDATE_FORMATS.filter((format) => pickMimeType(format) !== null)
}

/** Расширение по фактическому mime-типу (WebM/OGG/MP4 внутри контейнера). */
function extensionForMimeType(mimeType: string, fallback: string): string {
  const normalized = mimeType.toLowerCase()
  if (normalized.includes('ogg')) return 'ogg'
  if (normalized.includes('webm')) return 'webm'
  if (normalized.includes('mp4') || normalized.includes('aac') || normalized.includes('m4a')) {
    return 'm4a'
  }
  return fallback
}

/**
 * Перекодирование в «нативный» контейнер.
 *
 * MediaRecorder умеет кодировать только живой поток, поэтому сигнал
 * проигрывается в реальном времени через MediaStreamAudioDestinationNode,
 * а прогресс отдаётся наружу через onProgress.
 */
export async function encodeWithMediaRecorder(
  pcm: PcmData,
  format: NativeFormat,
  onProgress?: (progress: number) => void,
): Promise<NativeEncodeResult> {
  const mimeType = pickMimeType(format)
  if (!mimeType) {
    throw new Error(`Формат ${format.label} не поддерживается этим браузером`)
  }
  if (pcmLength(pcm) === 0) {
    throw new Error('Нечего кодировать: запись пустая')
  }

  const AudioContextCtor = window.AudioContext
  const context = new AudioContextCtor()
  const duration = pcmDuration(pcm)

  try {
    const buffer = context.createBuffer(
      Math.max(1, pcm.channels.length),
      pcmLength(pcm),
      pcm.sampleRate,
    )
    pcm.channels.forEach((data, index) => {
      buffer.copyToChannel(new Float32Array(data), index)
    })

    const source = context.createBufferSource()
    source.buffer = buffer

    const destination = context.createMediaStreamDestination()
    source.connect(destination)

    const recorder = new MediaRecorder(destination.stream, {
      mimeType,
      audioBitsPerSecond: 128000,
    })
    const chunks: Blob[] = []
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    })

    const finished = new Promise<Blob>((resolve, reject) => {
      recorder.addEventListener('stop', () => resolve(new Blob(chunks, { type: mimeType })))
      recorder.addEventListener('error', () => reject(new Error('Ошибка перекодирования аудио')))
    })
    source.addEventListener('ended', () => {
      if (recorder.state !== 'inactive') recorder.stop()
      source.disconnect()
    })

    await context.resume()
    recorder.start(200)
    const startedAt = context.currentTime
    source.start()

    const progressTimer = window.setInterval(() => {
      const progress = duration > 0 ? (context.currentTime - startedAt) / duration : 1
      onProgress?.(Math.min(0.99, Math.max(0, progress)))
    }, 200)

    try {
      const blob = await finished
      onProgress?.(1)
      return {
        blob,
        mimeType,
        extension: extensionForMimeType(mimeType, format.extension),
      }
    } finally {
      window.clearInterval(progressTimer)
    }
  } finally {
    await context.close()
  }
}
