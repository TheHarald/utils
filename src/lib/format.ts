/** Общие функции форматирования и небольшие хелперы для интерфейса. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** 12.345 → «0:12.3» — используется для коротких записей и таймера. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0'
  const minutes = Math.floor(seconds / 60)
  const rest = seconds - minutes * 60
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`
}

/** 125.7 → «02:05» — компактный формат «часы:минуты» для плеера. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00'
  const total = Math.round(seconds)
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Б'
  if (bytes < 1024) return `${Math.round(bytes)} Б`
  const units = ['КБ', 'МБ', 'ГБ']
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
}

/** Убирает из имени файла всё, что может сломать скачивание. */
export function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}._-]+/gu, '')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 80)
}

/** «2026-11-09_14-32» — удобный суффикс для имён файлов. */
export function timestampSuffix(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`
}

export function defaultRecordingName(): string {
  return `voice-${timestampSuffix()}`
}

/** Децибелы → линейный коэффициент усиления. */
export function dBToGain(db: number): number {
  return 10 ** (db / 20)
}

/** Линейная амплитуда → децибелы (для индикатора уровня). */
export function amplitudeToDb(amplitude: number): number {
  if (amplitude <= 0) return -Infinity
  return 20 * Math.log10(amplitude)
}
