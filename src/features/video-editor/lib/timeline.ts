import { clamp } from '@/lib/format'

/** Фрагмент монтажной шкалы: ссылка на исходный файл и границы внутри него. */
export interface VideoClip {
  id: string
  assetId: string
  /** Начало фрагмента в исходном файле, секунды. */
  start: number
  /** Конец фрагмента в исходном файле, секунды. */
  end: number
}

export interface TimelinePosition {
  index: number
  clip: VideoClip
  /** Время от начала клипа. */
  localTime: number
  /** Смещение клипа на общей шкале. */
  offset: number
}

/** Минимальная длина фрагмента — защита от «нулевых» клипов при обрезке и делении. */
export const MIN_CLIP_DURATION = 0.1

export function clipDuration(clip: VideoClip): number {
  return Math.max(0, clip.end - clip.start)
}

/** Длительность всего ролика — сумма длительностей фрагментов. */
export function timelineDuration(clips: VideoClip[]): number {
  let total = 0
  for (const clip of clips) total += clipDuration(clip)
  return total
}

/** Смещение клипа на общей шкале — сумма длительностей всех предыдущих. */
export function clipOffset(clips: VideoClip[], index: number): number {
  let offset = 0
  for (let i = 0; i < index && i < clips.length; i += 1) offset += clipDuration(clips[i])
  return offset
}

export function createClip(id: string, assetId: string, sourceDuration: number): VideoClip {
  return { id, assetId, start: 0, end: Math.max(sourceDuration, 0) }
}

/**
 * Какой фрагмент играет в момент `time` общей шкалы.
 * На границе клипов возвращается следующий — иначе последний кадр «залипает».
 */
export function locateTime(clips: VideoClip[], time: number): TimelinePosition | null {
  if (clips.length === 0) return null

  const total = timelineDuration(clips)
  const position = Number.isFinite(time) ? clamp(time, 0, total) : 0
  let offset = 0

  for (let index = 0; index < clips.length; index += 1) {
    const clip = clips[index]
    const duration = clipDuration(clip)
    if (position < offset + duration || index === clips.length - 1) {
      return { index, clip, localTime: clamp(position - offset, 0, duration), offset }
    }
    offset += duration
  }

  return null
}

export function findClipIndex(clips: VideoClip[], id: string | null): number {
  if (!id) return -1
  return clips.findIndex((clip) => clip.id === id)
}

/** Обрезка клипа: границы в пределах исходного файла и не короче MIN_CLIP_DURATION. */
export function trimClip(
  clip: VideoClip,
  start: number,
  end: number,
  limit: number = Number.POSITIVE_INFINITY,
): VideoClip {
  const max = Number.isFinite(limit)
    ? Math.max(limit, MIN_CLIP_DURATION)
    : Math.max(end, MIN_CLIP_DURATION)
  const safeEnd = clamp(Number.isFinite(end) ? end : clip.end, MIN_CLIP_DURATION, max)
  const safeStart = clamp(
    Number.isFinite(start) ? start : clip.start,
    0,
    Math.max(safeEnd - MIN_CLIP_DURATION, 0),
  )
  return { ...clip, start: safeStart, end: safeEnd }
}

/**
 * Делит клип по времени внутри него. Возвращает новый список или null,
 * если резать нечего: получившийся фрагмент был бы короче MIN_CLIP_DURATION.
 */
export function splitClip(
  clips: VideoClip[],
  index: number,
  localTime: number,
  newId: string,
): VideoClip[] | null {
  const clip = clips[index]
  if (!clip) return null

  const duration = clipDuration(clip)
  if (localTime < MIN_CLIP_DURATION || duration - localTime < MIN_CLIP_DURATION) return null

  const cut = clip.start + localTime
  const left: VideoClip = { ...clip, end: cut }
  const right: VideoClip = { id: newId, assetId: clip.assetId, start: cut, end: clip.end }
  return [...clips.slice(0, index), left, right, ...clips.slice(index + 1)]
}

/** Меняет клип местами с соседом. Если сдвиг невозможен, возвращает тот же массив. */
export function moveClip(clips: VideoClip[], index: number, direction: -1 | 1): VideoClip[] {
  const target = index + direction
  if (index < 0 || index >= clips.length || target < 0 || target >= clips.length) return clips

  const next = [...clips]
  const current = next[index]
  next[index] = next[target]
  next[target] = current
  return next
}

export function removeClip(clips: VideoClip[], index: number): VideoClip[] {
  if (index < 0 || index >= clips.length) return clips
  return [...clips.slice(0, index), ...clips.slice(index + 1)]
}

export function clipsUseAsset(clips: VideoClip[], assetId: string): boolean {
  return clips.some((clip) => clip.assetId === assetId)
}
