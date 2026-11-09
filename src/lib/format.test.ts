import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  amplitudeToDb,
  clamp,
  dBToGain,
  defaultRecordingName,
  formatBytes,
  formatClock,
  formatDuration,
  sanitizeFileName,
  timestampSuffix,
} from './format'

describe('clamp', () => {
  it('держит значение в диапазоне', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(50, 0, 10)).toBe(10)
  })
})

describe('formatDuration', () => {
  it('показывает минуты и десятые доли секунды', () => {
    expect(formatDuration(0)).toBe('0:00.0')
    expect(formatDuration(12.345)).toBe('0:12.3')
    expect(formatDuration(65.04)).toBe('1:05.0')
  })

  it('заменяет мусорные значения нулём', () => {
    expect(formatDuration(-1)).toBe('0:00.0')
    expect(formatDuration(Number.NaN)).toBe('0:00.0')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00.0')
  })
})

describe('formatClock', () => {
  it('округляет до секунд и дополняет нулями', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(59.4)).toBe('00:59')
    expect(formatClock(125.7)).toBe('02:06')
  })

  it('не пропускает отрицательные и NaN', () => {
    expect(formatClock(-3)).toBe('00:00')
    expect(formatClock(Number.NaN)).toBe('00:00')
  })
})

describe('formatBytes', () => {
  it('выбирает подходящую единицу', () => {
    expect(formatBytes(0)).toBe('0 Б')
    expect(formatBytes(-10)).toBe('0 Б')
    expect(formatBytes(512)).toBe('512 Б')
    expect(formatBytes(1536)).toBe('1.5 КБ')
    expect(formatBytes(1024 * 1024)).toBe('1.0 МБ')
    expect(formatBytes(15 * 1024 * 1024)).toBe('15 МБ')
  })
})

describe('sanitizeFileName', () => {
  it('убирает пробелы и опасные символы', () => {
    expect(sanitizeFileName('  my  voice?.wav ')).toBe('my-voice.wav')
    expect(sanitizeFileName('a/b\\c:d*e')).toBe('abcde')
    expect(sanitizeFileName('...test...')).toBe('test')
  })

  it('сохраняет кириллицу и обрезает длинные имена', () => {
    expect(sanitizeFileName('Запись 1')).toBe('Запись-1')
    expect(sanitizeFileName('a'.repeat(200))).toHaveLength(80)
  })
})

describe('timestampSuffix / defaultRecordingName', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('форматирует дату как 2026-11-09_14-32', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 9, 14, 32))
    expect(timestampSuffix()).toBe('2026-11-09_14-32')
    expect(defaultRecordingName()).toBe('voice-2026-11-09_14-32')
  })

  it('принимает дату параметром', () => {
    expect(timestampSuffix(new Date(2026, 0, 5, 9, 7))).toBe('2026-01-05_09-07')
  })
})

describe('децибелы', () => {
  it('переводит дБ в коэффициент усиления', () => {
    expect(dBToGain(0)).toBeCloseTo(1, 10)
    expect(dBToGain(6)).toBeCloseTo(1.9953, 4)
    expect(dBToGain(-6)).toBeCloseTo(0.5012, 4)
  })

  it('переводит амплитуду в дБFS', () => {
    expect(amplitudeToDb(1)).toBeCloseTo(0, 10)
    expect(amplitudeToDb(0.5)).toBeCloseTo(-6.0206, 4)
    expect(amplitudeToDb(0)).toBe(Number.NEGATIVE_INFINITY)
  })
})
