import type { VideoAsset } from './assets'
import {
  estimateVideoBitrate,
  fitExportSize,
  mimeExtension,
  pickVideoMimeType,
} from './export-settings'
import { clipDuration, timelineDuration, type VideoClip } from './timeline'

export interface VideoExportOptions {
  clips: VideoClip[]
  assets: VideoAsset[]
  /** Целевая высота кадра; ширина считается по пропорциям первого фрагмента. */
  height: number
  fps: number
  includeAudio: boolean
  signal?: AbortSignal
  onProgress?: (progress: number) => void
}

export interface VideoExportResult {
  blob: Blob
  extension: 'mp4' | 'webm'
  mimeType: string
  width: number
  height: number
}

/** Сколько ждём метаданные и перемотку, прежде чем признать файл нечитаемым. */
const MEDIA_TIMEOUT_MS = 15_000
/** Допуск на «последний кадр»: видео редко доходит ровно до end. */
const END_EPSILON = 0.02
const ABORTED_MESSAGE = 'Экспорт отменён'

export function isVideoExportSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function'
  )
}

export function pickExportMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return null
  }
  return pickVideoMimeType((type) => MediaRecorder.isTypeSupported(type))
}

async function waitForEvent(target: HTMLMediaElement, event: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      window.clearTimeout(timeout)
      target.removeEventListener(event, handleDone)
      target.removeEventListener('error', handleError)
    }
    const handleDone = () => {
      finish()
      resolve()
    }
    const handleError = () => {
      finish()
      reject(new Error('Браузер не смог прочитать видеофайл'))
    }
    const timeout = window.setTimeout(() => {
      finish()
      reject(new Error('Видеофайл не успел загрузиться — попробуйте меньший файл'))
    }, MEDIA_TIMEOUT_MS)

    target.addEventListener(event, handleDone)
    target.addEventListener('error', handleError)
  })
}

/** Рисует кадр целиком в чёрные поля: пропорции исходника сохраняются без искажений. */
function drawFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
): void {
  context.fillStyle = '#000000'
  context.fillRect(0, 0, width, height)

  const sourceWidth = video.videoWidth || width
  const sourceHeight = video.videoHeight || height
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const drawWidth = Math.max(1, Math.round(sourceWidth * scale))
  const drawHeight = Math.max(1, Math.round(sourceHeight * scale))
  const x = Math.round((width - drawWidth) / 2)
  const y = Math.round((height - drawHeight) / 2)
  context.drawImage(video, x, y, drawWidth, drawHeight)
}

function abortError(): DOMException {
  return new DOMException(ABORTED_MESSAGE, 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError()
}


/**
 * Собирает ролик из фрагментов в реальном времени: кадры рисуются на canvas,
 * звук берётся из того же `<video>` через Web Audio, а `MediaRecorder` пишет поток.
 * Экспорт занимает примерно столько же времени, сколько длится ролик.
 */
export async function exportTimelineVideo(
  options: VideoExportOptions,
): Promise<VideoExportResult> {
  const { clips, assets, height, fps, includeAudio, signal, onProgress } = options

  if (clips.length === 0) throw new Error('На шкале нет фрагментов')
  if (!isVideoExportSupported()) {
    throw new Error('Браузер не умеет записывать видео из canvas — попробуйте Chrome или Firefox')
  }

  const mimeType = pickExportMimeType()
  if (!mimeType) throw new Error('Браузер не поддерживает запись видео в MediaRecorder')

  throwIfAborted(signal)

  const assetsById = new Map(assets.map((asset) => [asset.id, asset]))
  const firstAsset = assetsById.get(clips[0].assetId)
  const size = fitExportSize(firstAsset?.width ?? 0, firstAsset?.height ?? 0, height)
  const total = timelineDuration(clips)

  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas недоступен в этом браузере')

  const video = document.createElement('video')
  video.preload = 'auto'
  video.playsInline = true

  // Некоторые браузеры не играют видео вне DOM — ставим элемент незаметно.
  video.style.position = 'fixed'
  video.style.left = '-9999px'
  video.style.width = '2px'
  video.style.height = '2px'
  video.style.opacity = '0'
  video.style.pointerEvents = 'none'
  document.body.append(video)

  const canvasStream = canvas.captureStream(fps)
  const audioContext = includeAudio ? new AudioContext() : null
  const audioDestination = audioContext?.createMediaStreamDestination() ?? null
  let audioSource: MediaElementAudioSourceNode | null = null

  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(audioDestination ? audioDestination.stream.getAudioTracks() : []),
  ])

  const chunks: Blob[] = []
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: estimateVideoBitrate(size.width, size.height, fps),
    audioBitsPerSecond: includeAudio ? 128_000 : undefined,
  })
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  })

  const stopped = new Promise<void>((resolve, reject) => {
    recorder.addEventListener('stop', () => resolve(), { once: true })
    recorder.addEventListener('error', () => reject(new Error('Браузер прервал запись')), {
      once: true,
    })
  })

  let loadedUrl: string | null = null

  const ensureAsset = async (asset: VideoAsset) => {
    if (loadedUrl === asset.url) return
    throwIfAborted(signal)
    loadedUrl = asset.url
    video.src = asset.url
    video.load()
    await waitForEvent(video, 'loadedmetadata')
  }

  const seekTo = async (time: number) => {
    throwIfAborted(signal)
    if (Math.abs(video.currentTime - time) < 0.005) return
    video.currentTime = time
    await waitForEvent(video, 'seeked')
  }

  try {
    if (audioContext && audioDestination) {
      await audioContext.resume()
      audioSource = audioContext.createMediaElementSource(video)
      // К колонкам не подключаем: во время экспорта звук не должен играть вслух.
      audioSource.connect(audioDestination)
    }

    drawFrame(context, video, size.width, size.height)
    recorder.start(250)

    let rendered = 0
    for (const clip of clips) {
      throwIfAborted(signal)

      const asset = assetsById.get(clip.assetId)
      if (!asset) throw new Error('Исходный файл фрагмента не найден на шкале')

      const clipLength = clipDuration(clip)
      await ensureAsset(asset)
      await seekTo(clip.start)
      await video.play()

      const startedAt = video.currentTime
      const wallClockStart = performance.now()

      await new Promise<void>((resolve, reject) => {
        const step = () => {
          try {
            throwIfAborted(signal)
          } catch (error) {
            reject(error)
            return
          }

          drawFrame(context, video, size.width, size.height)

          const played = Math.max(0, Math.min(video.currentTime - startedAt, clipLength))
          onProgress?.(Math.min(1, (rendered + played) / total))

          const timedOut = performance.now() - wallClockStart > clipLength * 1000 + 10_000
          if (played >= clipLength - END_EPSILON || video.ended || timedOut) {
            resolve()
            return
          }
          // Таймер вместо rAF: экспорт продолжается, даже если вкладка не в фокусе.
          window.setTimeout(step, Math.max(0, Math.round(1000 / fps)))
        }
        step()
      })

      video.pause()
      rendered += clipLength
      onProgress?.(Math.min(1, rendered / total))
    }

    throwIfAborted(signal)
    video.pause()
    recorder.stop()
    await stopped

    if (chunks.length === 0) throw new Error('Не удалось записать видео — файл получился пустым')
    onProgress?.(1)

    return {
      blob: new Blob(chunks, { type: mimeType }),
      extension: mimeExtension(mimeType),
      mimeType,
      width: size.width,
      height: size.height,
    }
  } finally {
    if (recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        /* уже остановлен */
      }
    }
    video.pause()
    video.removeAttribute('src')
    video.load()
    video.remove()

    audioSource?.disconnect()
    audioDestination?.disconnect()
    canvasStream.getTracks().forEach((track) => track.stop())
    stream.getTracks().forEach((track) => track.stop())
    if (audioContext) await audioContext.close().catch(() => undefined)
  }
}
