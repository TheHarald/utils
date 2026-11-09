import { formatBuildDate, parseBuildInfo } from '../src/app/build-info'

/**
 * Проверка разбора /info.json, который генерирует workflow:
 * валидный файл, BOM, битый JSON и формат даты.
 * Запуск: npm run check:build-info
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const raw = '{"buildDate":"2026-11-09T17:45:12Z","buildVersion":"4050ea9"}'

const info = parseBuildInfo(raw)
assert(info !== null, 'Валидный info.json должен разбираться')
assert(info.buildVersion === '4050ea9', 'Хэш сборки должен читаться')
assert(info.buildDate === '2026-11-09T17:45:12Z', 'Дата сборки должна читаться')

assert(parseBuildInfo(`\uFEFF${raw}`) !== null, 'BOM не должен ломать разбор')
assert(parseBuildInfo('') === null, 'Пустой файл должен давать null')
assert(parseBuildInfo('not json') === null, 'Битый JSON должен давать null')
assert(parseBuildInfo('null') === null, 'null должен давать null')
assert(parseBuildInfo('{"buildDate":1,"buildVersion":2}') === null, 'Неверные типы должны давать null')

assert(
  formatBuildDate('2026-11-09T17:45:12Z') === '09.11.2026',
  'Дата должна форматироваться как ДД.ММ.ГГГГ',
)
assert(formatBuildDate('oops') === null, 'Невалидная дата должна давать null')

console.log('OK: build-info парсится корректно')
