import { formatDuration } from '@/lib/format'

/** Исходный видеофайл, добавленный в проект. */
export interface VideoAsset {
  id: string
  name: string
  /** object URL: живёт до перезагрузки вкладки. */
  url: string
  /** Длительность исходного файла, секунды. */
  duration: number
  width: number
  height: number
  /** Размер файла в байтах. */
  size: number
}

/** Расширения, которые обычно проигрываются: mime при drag&drop бывает пустым. */
const VIDEO_EXTENSIONS = ['.mp4', '.m4v', '.webm', '.ogv', '.ogg', '.mov', '.mkv']

/** Проверка файла до чтения метаданных, чтобы отсечь картинки и документы. */
export function isVideoFile(file: { type: string; name: string }): boolean {
  if (file.type.startsWith('video/')) return true
  if (file.type) return false
  const name = file.name.toLowerCase()
  return VIDEO_EXTENSIONS.some((extension) => name.endsWith(extension))
}

export function assetResolution(asset: VideoAsset): string {
  if (asset.width <= 0 || asset.height <= 0) return 'размер неизвестен'
  return `${asset.width}×${asset.height}`
}

/** «1280×720 · 0:12.3» — компактная подпись файла в интерфейсе. */
export function assetSummary(asset: VideoAsset): string {
  return `${assetResolution(asset)} · ${formatDuration(asset.duration)}`
}
