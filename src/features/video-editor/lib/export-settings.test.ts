import { describe, expect, it } from 'vitest'
import {
  AUDIO_BITRATE,
  estimateVideoBitrate,
  estimateVideoBytes,
  fitExportSize,
  mimeExtension,
  pickVideoMimeType,
} from './export-settings'

describe('fitExportSize', () => {
  it('сохраняет пропорции источника и чётные стороны', () => {
    expect(fitExportSize(1920, 1080, 720)).toEqual({ width: 1280, height: 720 })
    expect(fitExportSize(1920, 1080, 480)).toEqual({ width: 854, height: 480 })
    expect(fitExportSize(1080, 1920, 720)).toEqual({ width: 406, height: 720 })
  })

  it('берёт 16:9, если размеры источника неизвестны', () => {
    expect(fitExportSize(0, 0, 720)).toEqual({ width: 1280, height: 720 })
  })

  it('делает высоту чётной', () => {
    expect(fitExportSize(1280, 720, 731).height % 2).toBe(0)
    expect(fitExportSize(1280, 720, 731).height).toBe(732)
  })

  it('не отдаёт нулевые стороны', () => {
    const size = fitExportSize(0, 0, 1)
    expect(size.height).toBeGreaterThanOrEqual(2)
    expect(size.width).toBeGreaterThanOrEqual(2)
  })
})

describe('mime-типы записи', () => {
  it('выбирает первый поддерживаемый формат', () => {
    expect(pickVideoMimeType(() => true)).toBe('video/webm;codecs=vp9,opus')
    expect(pickVideoMimeType((type) => type === 'video/webm')).toBe('video/webm')
  })

  it('берёт MP4, если WebM не поддержан (Safari)', () => {
    expect(pickVideoMimeType((type) => type.startsWith('video/mp4'))).toBe(
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    )
  })

  it('возвращает null, если писать нечем', () => {
    expect(pickVideoMimeType(() => false)).toBeNull()
  })

  it('определяет расширение по mime-типу', () => {
    expect(mimeExtension('video/webm;codecs=vp9,opus')).toBe('webm')
    expect(mimeExtension('video/mp4;codecs=avc1.42E01E,mp4a.40.2')).toBe('mp4')
  })
})

describe('оценка битрейта и размера', () => {
  it('считает битрейт от числа пикселей и кадров', () => {
    expect(estimateVideoBitrate(1280, 720, 30)).toBe(2_764_800)
  })

  it('держит битрейт в разумных границах', () => {
    expect(estimateVideoBitrate(160, 120, 24)).toBe(1_000_000)
    expect(estimateVideoBitrate(3840, 2160, 60)).toBe(12_000_000)
  })

  it('прогнозирует размер файла с учётом звука', () => {
    const videoBits = estimateVideoBitrate(1280, 720, 30)
    expect(estimateVideoBytes(10, 1280, 720, 30, false)).toBe((videoBits * 10) / 8)
    expect(estimateVideoBytes(10, 1280, 720, 30, true)).toBe(
      ((videoBits + AUDIO_BITRATE) * 10) / 8,
    )
  })

  it('для пустого ролика даёт нулевой размер', () => {
    expect(estimateVideoBytes(0, 1280, 720, 30, true)).toBe(0)
    expect(estimateVideoBytes(Number.NaN, 1280, 720, 30, true)).toBe(0)
  })
})
