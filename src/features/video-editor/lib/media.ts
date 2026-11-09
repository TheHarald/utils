import type { VideoAsset } from './assets'
import { isVideoFile } from './assets'

export interface VideoMetadata {
  duration: number
  width: number
  height: number
}

/** Чтение метаданных требует DOM-видео и object URL — проверяем до открытия диалога. */
export function isVideoImportSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function'
  )
}

export function releaseVideoUrl(url: string): void {
  if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
}

/**
 * Читает размеры и длительность файла в скрытом `<video>`.
 * Файл не декодируется целиком: достаточно события `loadedmetadata`.
 */
export function readVideoMetadata(url: string): Promise<VideoMetadata> {
  return new Promise<VideoMetadata>((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }

    video.addEventListener(
      'loadedmetadata',
      () => {
        const duration = Number.isFinite(video.duration) ? video.duration : 0
        if (duration <= 0) {
          cleanup()
          reject(new Error('Не удалось определить длительность видео'))
          return
        }
        resolve({ duration, width: video.videoWidth, height: video.videoHeight })
        cleanup()
      },
      { once: true },
    )

    video.addEventListener(
      'error',
      () => {
        cleanup()
        reject(new Error('Браузер не смог открыть этот файл — формат не поддерживается'))
      },
      { once: true },
    )

    video.src = url
  })
}

/** Проверяет файл, создаёт object URL и читает метаданные; при ошибке URL освобождается. */
export async function prepareVideo(file: File, id: string): Promise<VideoAsset> {
  if (!isVideoFile(file)) throw new Error('Это не видеофайл')

  const url = URL.createObjectURL(file)
  try {
    const meta = await readVideoMetadata(url)
    return {
      id,
      name: file.name,
      url,
      duration: meta.duration,
      width: meta.width,
      height: meta.height,
      size: file.size,
    }
  } catch (error) {
    releaseVideoUrl(url)
    throw error
  }
}
