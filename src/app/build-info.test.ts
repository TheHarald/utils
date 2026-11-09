import { describe, expect, it } from 'vitest'
import { formatBuildDate, parseBuildInfo } from './build-info'

const raw = '{"buildDate":"2026-11-09T17:45:12Z","buildVersion":"d96a528"}'

describe('parseBuildInfo', () => {
  it('разбирает файл, который генерирует workflow', () => {
    expect(parseBuildInfo(raw)).toEqual({
      buildDate: '2026-11-09T17:45:12Z',
      buildVersion: 'd96a528',
    })
  })

  it('терпит BOM и лишние пробелы', () => {
    expect(parseBuildInfo(`\uFEFF${raw}`)).not.toBeNull()
    expect(parseBuildInfo(`\n  ${raw}\n`)).not.toBeNull()
  })

  it('игнорирует дополнительные поля', () => {
    const parsed = parseBuildInfo('{"buildDate":"x","buildVersion":"y","extra":1}')
    expect(parsed).toMatchObject({ buildDate: 'x', buildVersion: 'y' })
  })

  it.each([
    ['пустой файл', ''],
    ['битый JSON', 'not json'],
    ['null', 'null'],
    ['массив', '[]'],
    ['неверные типы', '{"buildDate":1,"buildVersion":2}'],
    ['нет поля', '{"buildDate":"2026-11-09T17:45:12Z"}'],
  ])('возвращает null для %s', (_label, input) => {
    expect(parseBuildInfo(input)).toBeNull()
  })
})

describe('formatBuildDate', () => {
  it('показывает дату как ДД.ММ.ГГГГ', () => {
    // Дата собрана из локальных компонентов, поэтому результат не зависит от часового пояса.
    const iso = new Date(2026, 10, 9, 12, 0).toISOString()
    expect(formatBuildDate(iso)).toBe('09.11.2026')
  })

  it('возвращает null для невалидной даты', () => {
    expect(formatBuildDate('oops')).toBeNull()
    expect(formatBuildDate('')).toBeNull()
  })
})
