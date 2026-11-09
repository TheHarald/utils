import { describe, expect, it } from 'vitest'
import {
  MIN_CLIP_DURATION,
  clipDuration,
  clipOffset,
  clipsUseAsset,
  createClip,
  findClipIndex,
  locateTime,
  moveClip,
  removeClip,
  splitClip,
  timelineDuration,
  trimClip,
  type VideoClip,
} from './timeline'

function makeClip(id: string, assetId = 'asset', start = 0, end = 4): VideoClip {
  return { id, assetId, start, end }
}

/** Три фрагмента: 4 с + 3 с + 1 с = 8 с на шкале. */
const clips = [
  makeClip('a', 'asset-1', 0, 4),
  makeClip('b', 'asset-2', 2, 5),
  makeClip('c', 'asset-1', 0, 1),
]

describe('длительности и смещения', () => {
  it('суммирует длительности фрагментов', () => {
    expect(clipDuration(makeClip('a', 'asset', 1, 3.5))).toBeCloseTo(2.5)
    expect(timelineDuration(clips)).toBe(8)
    expect(timelineDuration([])).toBe(0)
  })

  it('не отдаёт отрицательную длительность', () => {
    expect(clipDuration(makeClip('a', 'asset', 4, 1))).toBe(0)
  })

  it('считает смещение клипа на общей шкале', () => {
    expect(clipOffset(clips, 0)).toBe(0)
    expect(clipOffset(clips, 1)).toBe(4)
    expect(clipOffset(clips, 2)).toBe(7)
    // Индекс за пределами списка — конец шкалы.
    expect(clipOffset(clips, 9)).toBe(8)
  })

  it('создаёт клип на весь файл и не уходит в минус', () => {
    expect(createClip('a', 'asset', 12)).toEqual({ id: 'a', assetId: 'asset', start: 0, end: 12 })
    expect(clipDuration(createClip('b', 'asset', -3))).toBe(0)
  })
})

describe('locateTime', () => {
  it('находит фрагмент по времени', () => {
    expect(locateTime(clips, 0)).toMatchObject({ index: 0, localTime: 0, offset: 0 })
    expect(locateTime(clips, 5)).toMatchObject({ index: 1, localTime: 1, offset: 4 })
    expect(locateTime(clips, 7.5)).toMatchObject({ index: 2, localTime: 0.5, offset: 7 })
  })

  it('на границе клипов отдаёт следующий фрагмент', () => {
    expect(locateTime(clips, 4)).toMatchObject({ index: 1, localTime: 0 })
    expect(locateTime(clips, 7)).toMatchObject({ index: 2, localTime: 0 })
  })

  it('прижимает время к шкале', () => {
    expect(locateTime(clips, -5)).toMatchObject({ index: 0, localTime: 0 })
    expect(locateTime(clips, 100)).toMatchObject({ index: 2, localTime: 1 })
    expect(locateTime(clips, Number.NaN)).toMatchObject({ index: 0, localTime: 0 })
  })

  it('для пустой шкалы возвращает null', () => {
    expect(locateTime([], 3)).toBeNull()
  })
})

describe('findClipIndex', () => {
  it('ищет клип по id', () => {
    expect(findClipIndex(clips, 'b')).toBe(1)
    expect(findClipIndex(clips, 'nope')).toBe(-1)
    expect(findClipIndex(clips, null)).toBe(-1)
  })
})

describe('trimClip', () => {
  it('меняет границы внутри файла', () => {
    const trimmed = trimClip(makeClip('a', 'asset', 0, 4), 1, 3, 4)
    expect(trimmed.start).toBe(1)
    expect(trimmed.end).toBe(3)
    expect(trimmed.id).toBe('a')
  })

  it('не выходит за длительность файла', () => {
    expect(trimClip(makeClip('a', 'asset', 0, 4), -2, 99, 5)).toMatchObject({ start: 0, end: 5 })
  })

  it('оставляет минимальную длину при обратных границах', () => {
    const trimmed = trimClip(makeClip('a', 'asset', 0, 4), 3, 1, 4)
    expect(trimmed.end).toBe(1)
    expect(clipDuration(trimmed)).toBeCloseTo(MIN_CLIP_DURATION)
  })

  it('не допускает клип короче минимума', () => {
    const trimmed = trimClip(makeClip('a', 'asset', 0, 4), 0, 0.01, 0.01)
    expect(clipDuration(trimmed)).toBeCloseTo(MIN_CLIP_DURATION)
  })

  it('игнорирует нечисловые границы', () => {
    const trimmed = trimClip(makeClip('a', 'asset', 1, 4), Number.NaN, Number.NaN, 10)
    expect(trimmed).toMatchObject({ start: 1, end: 4 })
  })
})

describe('splitClip', () => {
  it('делит фрагмент на две части по курсору', () => {
    const result = splitClip(clips, 0, 2, 'new')
    expect(result).not.toBeNull()
    expect(result).toHaveLength(4)
    expect(result?.map((clip) => clip.id)).toEqual(['a', 'new', 'b', 'c'])
    expect(result?.[0]).toMatchObject({ id: 'a', start: 0, end: 2 })
    expect(result?.[1]).toMatchObject({ id: 'new', assetId: 'asset-1', start: 2, end: 4 })
    // Исходный массив не меняется.
    expect(clips).toHaveLength(3)
  })

  it('не режет слишком близко к краям', () => {
    expect(splitClip(clips, 0, MIN_CLIP_DURATION / 2, 'new')).toBeNull()
    expect(splitClip(clips, 0, 4 - MIN_CLIP_DURATION / 2, 'new')).toBeNull()
  })

  it('возвращает null для неверного индекса', () => {
    expect(splitClip(clips, 5, 1, 'new')).toBeNull()
  })
})

describe('moveClip', () => {
  it('меняет фрагменты местами', () => {
    expect(moveClip(clips, 0, 1).map((clip) => clip.id)).toEqual(['b', 'a', 'c'])
    expect(moveClip(clips, 2, -1).map((clip) => clip.id)).toEqual(['a', 'c', 'b'])
  })

  it('на краях возвращает тот же массив', () => {
    expect(moveClip(clips, 0, -1)).toBe(clips)
    expect(moveClip(clips, 2, 1)).toBe(clips)
    expect(moveClip(clips, -1, 1)).toBe(clips)
  })
})

describe('removeClip', () => {
  it('удаляет фрагмент по индексу', () => {
    expect(removeClip(clips, 1).map((clip) => clip.id)).toEqual(['a', 'c'])
  })

  it('не трогает список при неверном индексе', () => {
    expect(removeClip(clips, 9)).toBe(clips)
    expect(removeClip(clips, -1)).toBe(clips)
  })
})

describe('clipsUseAsset', () => {
  it('сообщает, занят ли файл на шкале', () => {
    expect(clipsUseAsset(clips, 'asset-1')).toBe(true)
    expect(clipsUseAsset(clips, 'asset-3')).toBe(false)
    expect(clipsUseAsset([], 'asset-1')).toBe(false)
  })
})
