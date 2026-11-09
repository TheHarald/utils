import { clamp } from '@/lib/format'
import { pcmLength, pcmToMono, type PcmData } from './pcm'

/** Обрезка по времени в секундах. */
export function trimPcm(pcm: PcmData, startSeconds: number, endSeconds: number): PcmData {
  const total = pcmLength(pcm)
  const start = clamp(Math.round(startSeconds * pcm.sampleRate), 0, total)
  const end = clamp(Math.round(endSeconds * pcm.sampleRate), start, total)
  const length = Math.max(1, end - start)

  return {
    sampleRate: pcm.sampleRate,
    channels: pcm.channels.map((data) => {
      const output = new Float32Array(length)
      output.set(data.subarray(start, start + length))
      return output
    }),
  }
}

/** Общий множитель для усиления и нормализации: сэмплы клиппируются по −1…1. */
function scalePcm(pcm: PcmData, factor: number): PcmData {
  return {
    sampleRate: pcm.sampleRate,
    channels: pcm.channels.map((data) => {
      const output = new Float32Array(data.length)
      for (let i = 0; i < data.length; i += 1) {
        output[i] = clamp(data[i] * factor, -1, 1)
      }
      return output
    }),
  }
}

/** Усиление/ослабление сигнала (линейный коэффициент). */
export function applyGain(pcm: PcmData, gain: number): PcmData {
  return scalePcm(pcm, clamp(gain, 0, 8))
}

/** Максимальная амплитуда по всем каналам. */
export function pcmPeak(pcm: PcmData): number {
  let peak = 0
  for (const data of pcm.channels) {
    for (let i = 0; i < data.length; i += 1) {
      const value = Math.abs(data[i])
      if (value > peak) peak = value
    }
  }
  return peak
}

/** Пиковый уровень в дБFS (для подсказок в интерфейсе). */
export function pcmPeakDb(pcm: PcmData): number {
  const peak = pcmPeak(pcm)
  if (peak <= 0) return -Infinity
  return 20 * Math.log10(peak)
}

/** Нормализация по пику до целевого уровня (по умолчанию −1 dBFS). */
export function normalizePcm(pcm: PcmData, targetDb = -1): PcmData {
  const peak = pcmPeak(pcm)
  if (peak <= 0.00001) return pcm
  const target = 10 ** (targetDb / 20)
  // Множитель не ограничиваем как в applyGain: тихую запись тоже нужно поднять.
  return scalePcm(pcm, target / peak)
}

/** Плавное появление в начале и затухание в конце. */
export function fadePcm(pcm: PcmData, fadeInSeconds: number, fadeOutSeconds: number): PcmData {
  const length = pcmLength(pcm)
  const fadeIn = clamp(Math.round(fadeInSeconds * pcm.sampleRate), 0, length)
  const fadeOut = clamp(Math.round(fadeOutSeconds * pcm.sampleRate), 0, length)

  return {
    sampleRate: pcm.sampleRate,
    channels: pcm.channels.map((data) => {
      const output = new Float32Array(data)
      for (let i = 0; i < fadeIn; i += 1) {
        output[i] *= i / fadeIn
      }
      for (let i = 0; i < fadeOut; i += 1) {
        const index = length - 1 - i
        output[index] *= i / fadeOut
      }
      return output
    }),
  }
}

/** Отрезает тишину по краям записи (с небольшим запасом). */
export function trimSilence(pcm: PcmData, thresholdDb = -45, paddingMs = 120): PcmData {
  const length = pcmLength(pcm)
  if (length === 0) return pcm

  const threshold = 10 ** (thresholdDb / 20)
  const mono = pcmToMono(pcm)

  let start = 0
  while (start < length && Math.abs(mono[start]) < threshold) start += 1
  if (start >= length) return pcm

  let end = length - 1
  while (end > start && Math.abs(mono[end]) < threshold) end -= 1
  if (end <= start) return pcm

  const padding = Math.round((paddingMs / 1000) * pcm.sampleRate)
  const from = Math.max(0, start - padding) / pcm.sampleRate
  const to = Math.min(length, end + padding) / pcm.sampleRate
  return trimPcm(pcm, from, to)
}

/** Пики по бинам (0…1) для отрисовки волны на canvas. */
export function computePeaks(pcm: PcmData, bars: number): number[] {
  const mono = pcmToMono(pcm)
  const count = Math.max(1, Math.round(bars))
  const peaks = new Array<number>(count).fill(0)
  if (mono.length === 0) return peaks

  const step = mono.length / count
  for (let bar = 0; bar < count; bar += 1) {
    const from = Math.floor(bar * step)
    const to = Math.min(mono.length, Math.max(from + 1, Math.floor((bar + 1) * step)))
    let peak = 0
    for (let i = from; i < to; i += 1) {
      const value = Math.abs(mono[i])
      if (value > peak) peak = value
    }
    peaks[bar] = peak
  }
  return peaks
}
