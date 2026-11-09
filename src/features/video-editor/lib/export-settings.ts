/** Настройки экспорта, не зависящие от DOM: их удобно проверять в тестах. */

export const EXPORT_HEIGHTS = [480, 720, 1080] as const
export type ExportHeight = (typeof EXPORT_HEIGHTS)[number]

export const EXPORT_FPS = [24, 30] as const
export type ExportFps = (typeof EXPORT_FPS)[number]

/** Битрейт звуковой дорожки в итоговом файле. */
export const AUDIO_BITRATE = 128_000

export interface ExportSize {
  width: number
  height: number
}

/** Пропорции по умолчанию, если исходный файл ещё не дал размеров. */
const FALLBACK_ASPECT = 16 / 9

/**
 * Подгоняет кадр под целевую высоту, сохраняя пропорции источника.
 * Стороны всегда чётные — этого требуют кодеки H.264/VP9.
 */
export function fitExportSize(
  sourceWidth: number,
  sourceHeight: number,
  targetHeight: number,
): ExportSize {
  const height = Math.max(2, Math.round(targetHeight / 2) * 2)
  const hasSource =
    Number.isFinite(sourceWidth) && Number.isFinite(sourceHeight) && sourceWidth > 0 && sourceHeight > 0
  const aspect = hasSource ? sourceWidth / sourceHeight : FALLBACK_ASPECT
  const width = Math.max(2, Math.round((height * aspect) / 2) * 2)
  return { width, height }
}

/** Mime-типы записи от лучшего к худшему: WebM/VP9 → WebM/VP8 → MP4 (Safari). */
export const VIDEO_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
] as const

export function pickVideoMimeType(isSupported: (type: string) => boolean): string | null {
  return VIDEO_MIME_CANDIDATES.find((type) => isSupported(type)) ?? null
}

/** Safari пишет MP4, остальные браузеры — WebM: расширение берём из mime-типа. */
export function mimeExtension(mimeType: string): 'mp4' | 'webm' {
  return mimeType.toLowerCase().includes('mp4') ? 'mp4' : 'webm'
}

/** ~0,1 бита на пиксель кадра с разумными границами — приемлемое качество при малом весе. */
export function estimateVideoBitrate(width: number, height: number, fps: number): number {
  const raw = width * height * fps * 0.1
  return Math.round(Math.min(Math.max(raw, 1_000_000), 12_000_000))
}

/** Прогноз размера файла: видео по рассчитанному битрейту плюс звук. */
export function estimateVideoBytes(
  duration: number,
  width: number,
  height: number,
  fps: number,
  includeAudio: boolean,
): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0
  const bitsPerSecond = estimateVideoBitrate(width, height, fps) + (includeAudio ? AUDIO_BITRATE : 0)
  return Math.round((bitsPerSecond * duration) / 8)
}
