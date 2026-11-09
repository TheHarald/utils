import { describe, expect, it } from 'vitest'
import {
  applyGain,
  computePeaks,
  fadePcm,
  normalizePcm,
  pcmPeak,
  pcmPeakDb,
  trimPcm,
  trimSilence,
} from './audio-edit'
import { createPcm, pcmLength, type PcmData } from './pcm'

const sampleRate = 8000

/** 1 секунда синусоиды 440 Гц с амплитудой 0.5. */
function makeTone(seconds = 1, amplitude = 0.5): PcmData {
  const pcm = createPcm(sampleRate, 1, Math.round(sampleRate * seconds))
  for (let i = 0; i < pcm.channels[0].length; i += 1) {
    pcm.channels[0][i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * amplitude
  }
  return pcm
}

describe('trimPcm', () => {
  it('обрезает по времени', () => {
    const trimmed = trimPcm(makeTone(), 0.25, 0.75)
    expect(pcmLength(trimmed)).toBe(sampleRate / 2)
    expect(trimmed.sampleRate).toBe(sampleRate)
  })

  it('не выходит за границы и не отдаёт пустой массив', () => {
    const pcm = makeTone()
    expect(pcmLength(trimPcm(pcm, -5, 5))).toBe(pcmLength(pcm))
    // Обратный порядок аргументов схлопывается в минимальную длину.
    expect(pcmLength(trimPcm(pcm, 0.8, 0.2))).toBe(1)
    expect(pcmLength(trimPcm(pcm, 5, 10))).toBe(1)
  })

  it('обрезает все каналы одинаково', () => {
    const stereo = createPcm(sampleRate, 2, 100)
    stereo.channels[1].fill(0.25)
    const trimmed = trimPcm(stereo, 0, 0.005)
    expect(trimmed.channels).toHaveLength(2)
    expect(pcmLength(trimmed)).toBe(40)
    expect(trimmed.channels[1][0]).toBe(0.25)
  })
})

describe('applyGain', () => {
  it('усиливает и ослабляет сигнал', () => {
    const pcm = makeTone()
    const peak = pcmPeak(pcm)
    expect(pcmPeak(applyGain(pcm, 2))).toBeCloseTo(peak * 2, 6)
    expect(pcmPeak(applyGain(pcm, 0.5))).toBeCloseTo(peak * 0.5, 6)
  })

  it('обрезает по −1…1 и ограничивает коэффициент', () => {
    const hot = createPcm(sampleRate, 1, 2)
    hot.channels[0][0] = 0.9
    hot.channels[0][1] = -0.9
    const loud = applyGain(hot, 4)
    expect(loud.channels[0][0]).toBe(1)
    expect(loud.channels[0][1]).toBe(-1)
    // Коэффициент больше 8 не применяется.
    expect(Array.from(applyGain(hot, 100).channels[0])).toEqual(Array.from(applyGain(hot, 8).channels[0]))
    // Нулевой коэффициент — тишина.
    expect(pcmPeak(applyGain(hot, 0))).toBe(0)
  })
})

describe('pcmPeak / pcmPeakDb', () => {
  it('считает пик по всем каналам', () => {
    const stereo = createPcm(sampleRate, 2, 2)
    stereo.channels[0][0] = 0.3
    stereo.channels[1][1] = -0.8
    expect(pcmPeak(stereo)).toBeCloseTo(0.8, 6)
    expect(pcmPeakDb(stereo)).toBeCloseTo(-1.9382, 3)
  })

  it('для тишины пик в дБ равен −∞', () => {
    expect(pcmPeak(createPcm(sampleRate, 1, 10))).toBe(0)
    expect(pcmPeakDb(createPcm(sampleRate, 1, 10))).toBe(Number.NEGATIVE_INFINITY)
  })
})

describe('normalizePcm', () => {
  it('поднимает пик до −1 dBFS', () => {
    const peak = pcmPeak(normalizePcm(makeTone(1, 0.1)))
    expect(peak).toBeCloseTo(10 ** (-1 / 20), 4)
  })

  it('тишину не трогает и возвращает тот же объект', () => {
    const silence = createPcm(sampleRate, 1, 10)
    expect(normalizePcm(silence)).toBe(silence)
  })
})

describe('fadePcm', () => {
  it('делает плавное появление и затухание', () => {
    const pcm = makeTone()
    const faded = fadePcm(pcm, 0.1, 0.1)
    const data = faded.channels[0]
    expect(Math.abs(data[0])).toBeLessThan(0.01)
    expect(Math.abs(data[data.length - 1])).toBeLessThan(0.01)
    // Середина не меняется.
    const middle = Math.floor(data.length / 2)
    expect(data[middle]).toBeCloseTo(pcm.channels[0][middle], 6)
  })

  it('не падает, если фейд длиннее записи', () => {
    const pcm = makeTone(0.1)
    const faded = fadePcm(pcm, 5, 5)
    expect(pcmLength(faded)).toBe(pcmLength(pcm))
    expect(pcmPeak(faded)).toBeLessThanOrEqual(pcmPeak(pcm))
  })
})

describe('trimSilence', () => {
  it('отрезает тишину по краям с запасом', () => {
    const pcm = createPcm(sampleRate, 1, sampleRate) // 1 c
    // Тон звучит с 0.4 до 0.6 секунды, вокруг — тишина.
    for (let i = 0.4 * sampleRate; i < 0.6 * sampleRate; i += 1) {
      pcm.channels[0][i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.5
    }
    const trimmed = trimSilence(pcm)
    const duration = pcmLength(trimmed) / sampleRate
    expect(duration).toBeGreaterThan(0.19)
    expect(duration).toBeLessThan(0.45)
  })

  it('возвращает исходник, если тишина сплошная', () => {
    const silence = createPcm(sampleRate, 1, 100)
    expect(trimSilence(silence)).toBe(silence)
  })

  it('не падает на пустом массиве', () => {
    const empty = createPcm(sampleRate, 1, 0)
    expect(trimSilence(empty)).toBe(empty)
  })
})

describe('computePeaks', () => {
  it('возвращает нужное число бинов в диапазоне 0…1', () => {
    const peaks = computePeaks(makeTone(), 32)
    expect(peaks).toHaveLength(32)
    expect(peaks.every((value) => value >= 0 && value <= 1)).toBe(true)
    expect(Math.max(...peaks)).toBeCloseTo(0.5, 2)
  })

  it('минимум один бин и нули для пустых данных', () => {
    expect(computePeaks(makeTone(), 0)).toHaveLength(1)
    expect(computePeaks(createPcm(sampleRate, 1, 0), 8)).toEqual(new Array(8).fill(0))
  })
})
