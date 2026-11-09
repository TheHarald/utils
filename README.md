# utils

Коллекция небольших веб-утилит, которые работают целиком в браузере: без регистрации, без загрузки файлов на сервер.

Сайт: <https://theharald.github.io/utils/>

## Что уже готово

**Запись голоса** (`/tools/voice-recorder`)

- запись с микрофона через `MediaRecorder` с паузой и продолжением;
- индикатор уровня сигнала и таймер;
- интерактивная волна на `canvas`: перемотка, выделение фрагмента, ручки границ;
- редактирование: обрезка по выделению, удаление тишины по краям, нормализация до −1 дБ,
  усиление в дБ, fade in / fade out, отмена действий;
- экспорт: **WAV** (16-bit PCM, собственный энкодер), **MP3** (lamejs, 128/192/320 кбит/с)
  и нативные контейнеры браузера — **WebM/Opus**, **OGG/Opus**, **M4A/AAC**
  (доступность определяется через `MediaRecorder.isTypeSupported`);
- всё аудио обрабатывается локально: `getUserMedia` → `decodeAudioData` → правки в `Float32Array` → скачивание.

**Редактор видео** (`/tools/video-editor`)

- импорт видеофайлов перетаскиванием или через диалог: `object URL` + чтение метаданных
  в скрытом `<video>`, файлы не покидают устройство;
- шкала из фрагментов: выбор, перемотка по клику, резка по курсору, обрезка границ,
  порядок фрагментов и удаление (файл освобождается, когда на него нет ссылок);
- предпросмотр играет монтаж целиком, переключая источник между файлами;
- экспорт: кадры рисуются на `canvas` (пропорции источника, чёрные поля), звук идёт через
  Web Audio в `MediaStreamDestination`, поток пишет `MediaRecorder` — **WebM/VP9**,
  **WebM/VP8** или **MP4** (Safari); высота 480p/720p/1080p, 24 или 30 к/с;
- запись идёт в реальном времени: экспорт занимает примерно столько же, сколько длится ролик.

Остальные инструменты добавляются в реестр `TOOLS` (`src/app/tools.ts`) по мере готовности:
карточка на главной появляется только вместе с рабочей страницей, анонсов «скоро» нет.

## Стек

| Что | Зачем |
| --- | --- |
| React 19 + TypeScript | интерфейс и типобезопасность |
| Vite 8 | сборка и dev-сервер |
| MobX 7 + mobx-react-lite | состояние (тема, редакторы записи и видео) |
| Tailwind CSS 4 + shadcn/ui (radix-nova) | стили и доступные компоненты |
| @breezystack/lamejs | кодирование MP3 в браузере |
| react-router-dom (HashRouter) | маршруты, совместимые с GitHub Pages |
| Vitest + jsdom | юнит-тесты логики, сторов и энкодеров |

## Команды

```bash
npm install       # установка зависимостей
npm run dev       # dev-сервер (http://localhost:5173/utils/)
npm run build     # типы + production-сборка в dist/
npm run preview   # локальный просмотр собранного сайта
npm run lint      # ESLint
npm test          # тесты (Vitest, один прогон)
npm run test:watch  # тесты в режиме наблюдения
```

Запись с микрофона работает только на `localhost` или по HTTPS — это требование браузеров
к `getUserMedia`.

## Структура

```
src/
  app/            site.ts (метаданные), tools.ts (реестр инструментов), ToolRoute.tsx
  components/     каркас (header/footer/layout), shadcn-ui, иконки
  features/
    home/         главная: поиск, фильтры, карточки
    voice-recorder/
      lib/        pcm.ts, audio-edit.ts, recorder.ts, encoders/{wav,mp3,native}.ts
      store/      VoiceRecorderStore (MobX)
      components/ RecorderPanel, Waveform, PlaybackControls, EditorPanel, ExportPanel
      VoiceRecorderPage.tsx
    video-editor/
      lib/        timeline.ts, assets.ts, export-settings.ts, media.ts, export-video.ts
      store/      VideoEditorStore (MobX)
      components/ ImportPanel, PreviewPanel, TimelinePanel, ClipInspector, ExportPanel
      VideoEditorPage.tsx
  lib/            форматирование, скачивание файлов, cn()
  stores/         RootStore (тема), контекст и провайдер
```

Тесты лежат рядом с кодом: `*.test.ts` в тех же папках, что и проверяемые модули.

## Тесты

Стек — [Vitest](https://vitest.dev) + `jsdom`. Конфиг отдельный (`vitest.config.ts`), чтобы
тесты не тянули Tailwind и React-плагин из `vite.config.ts`; алиас `@` там продублирован.

| Файл | Что проверяет |
| --- | --- |
| `src/lib/format.test.ts` | длительности, размеры файлов, `sanitizeFileName`, дБ ↔ амплитуда |
| `src/app/build-info.test.ts` | разбор `/info.json`: BOM, битый JSON, неверные типы, формат даты |
| `src/app/tools.test.ts` | реестр инструментов: уникальные слаги, ленивые компоненты, категории, `getToolBySlug` |
| `src/features/voice-recorder/lib/pcm.test.ts` | `createPcm`, длительность, клонирование, микширование в моно |
| `src/features/voice-recorder/lib/audio-edit.test.ts` | обрезка, усиление, нормализация, фейды, удаление тишины, пики |
| `src/features/voice-recorder/lib/encoders/wav.test.ts` | заголовок RIFF/WAVE, 16 бит, чередование каналов, клиппинг |
| `src/features/voice-recorder/lib/encoders/mp3.test.ts` | frame sync, зависимость размера от битрейта, оценка размера |
| `src/features/voice-recorder/lib/encoders/native.test.ts` | доступность `MediaRecorder`-форматов и понятные ошибки |
| `src/features/voice-recorder/store/VoiceRecorderStore.test.ts` | выделение, правки, история, экспорт (скачивание замокано) |
| `src/features/video-editor/lib/timeline.test.ts` | длительности, поиск фрагмента по времени, обрезка, резка, порядок |
| `src/features/video-editor/lib/assets.test.ts` | распознавание видеофайлов, подписи с разрешением и длительностью |
| `src/features/video-editor/lib/export-settings.test.ts` | размеры кадра, выбор mime-типа, битрейт и прогноз размера |
| `src/features/video-editor/store/VideoEditorStore.test.ts` | импорт, монтаж, экспорт (медиа и скачивание замоканы) |
| `src/stores/themeStore.test.ts` | режимы темы, реакция на системную тему, сохранение выбора |

По умолчанию окружение — `node` (быстро). Файлам, которым нужен DOM, достаточно первой строки
`// @vitest-environment jsdom`; `matchMedia` в jsdom отсутствует, поэтому в тестах темы он подменяется стендом.

```bash
npm test                     # все тесты
npx vitest run src/lib       # только папка
npx vitest run -t "WAV"      # только тесты с подходящим названием
```

## Как добавить новый инструмент

1. Создать папку `src/features/<slug>/` с компонентом страницы (default export).
2. Добавить запись в массив `TOOLS` в `src/app/tools.ts`:

```ts
{
  slug: 'json-formatter',
  title: 'JSON-форматтер',
  description: 'Форматирование, минификация и проверка JSON.',
  icon: FileJson2,
  category: 'data',
  tags: ['json'],
  component: lazy(() => import('@/features/json-formatter/JsonFormatterPage')),
}
```

3. Маршрут `/tools/<slug>` и карточка на главной появятся автоматически.
   `component` обязателен: записей без рабочей страницы в реестре нет.

## Деплой на GitHub Pages

Репозиторий: `theHarald/utils`, адрес сайта — `https://theHarald.github.io/utils/`,
поэтому в `vite.config.ts` указан `base: '/utils/'`. Маршрутизация — `HashRouter`,
чтобы прямые ссылки на инструменты не давали 404.

Публикация идёт **через ветку `gh-pages`**: workflow собирает сайт и складывает готовый `dist/`
в отдельную ветку, а GitHub Pages раздаёт содержимое этой ветки. Ветку не нужно ни создавать,
ни трогать руками — её целиком перезаписывает следующий прогон.

### Что делает `.github/workflows/deploy.yml`

| Job | Шаги |
| --- | --- |
| `build` | `npm ci` → `npm run lint` → `npm test` → генерация `public/info.json` → `npm run build` → артефакт `production-files` (срок хранения 1 день) |
| `deploy` | скачивает артефакт и публикует `dist/` в ветку `gh-pages` через `peaceiris/actions-gh-pages@v4` с `force_orphan` (в ветке всегда один коммит, история артефактов не копится) |

Триггеры: push в `main` и ручной запуск (**Actions → Deploy to GitHub Pages → Run workflow**).
Если `lint` или тесты красные, ветка `gh-pages` не обновляется — сайт остаётся на прошлой сборке.

Права: workflow не запрашивает ничего лишнего — `build` работает с `contents: read`,
`deploy` с `contents: write` (нужен только для пуша в `gh-pages`).

### Разовая настройка (владелец репозитория)

1. Первый прогон: **Actions → Deploy to GitHub Pages → Run workflow** (или push в `main`).
   Он создаст ветку `gh-pages` — без неё шаг 2 не из чего выбирать.
2. **Settings → Pages → Build and deployment → Source: `Deploy from a branch`**,
   **Branch: `gh-pages`**, **Folder: `/ (root)`** → **Save**.
3. Через минуту сайт откроется на `https://theHarald.github.io/utils/`;
   после первого деплоя включится **Enforce HTTPS** (галочку GitHub ставит сам).

`Settings → Actions → General → Workflow permissions` должен быть в режиме
**Read and write permissions** — иначе пуш в `gh-pages` упадёт с `403`.
Никаких секретов добавлять не нужно: `GITHUB_TOKEN` выдаётся автоматически.

### Версия сборки в футере

Перед сборкой CI создаёт `public/info.json`:

```json
{ "buildDate": "2026-11-09T17:45:12Z", "buildVersion": "4050ea9" }
```

Файл попадает в `dist/info.json`, а футер показывает ссылку «сборка 4050ea9 · 09.11.2026»
на соответствующий коммит. Локально файла нет (он в `.gitignore`) — футер просто не показывает версию.
Кэш отключён (`cache: 'no-store'`), чтобы после деплоя не показывался старый хэш.

Локальный прогон того же пайплайна перед пушем:

```bash
npm ci && npm run lint && npm test && npm run build && npm run preview
```

Если репозиторий называется иначе, поменяйте `base` в `vite.config.ts` и `site.repoUrl`
в `src/app/site.ts`.

### Частые проблемы

| Симптом | Причина и решение |
| --- | --- |
| `403` на шаге `Deploy to GitHub Pages` | `Settings → Actions → General → Workflow permissions` стоит read-only — переключите на **Read and write** |
| Pages пишет «Your site is ready to be published», но 404 | в `Settings → Pages` выбран не тот источник: нужен **Deploy from a branch → `gh-pages` → `/ (root)`** |
| Сайт старый после зелёного прогона | кэш CDN Pages (до ~10 минут); проверьте `dist/info.json` в ветке `gh-pages` и хэш в футере |
| Нужен деплой без коммита | **Actions → Deploy to GitHub Pages → Run workflow** (`workflow_dispatch`) |

### Свой домен (опционально)

`public/CNAME` с доменом + DNS-запись `CNAME` на `theharald.github.io`, затем
**Settings → Pages → Custom domain**. `HashRouter` при этом менять не нужно,
а `base` в `vite.config.ts` заменить на `'/'` — только если сайт переезжает в корень домена.

## Приватность

Все вычисления выполняются в браузере. Аудио не отправляется по сети: запись хранится в памяти
вкладки (`Float32Array`) и исчезает после перезагрузки страницы. Единственное, что сохраняется
между сессиями, — выбранная тема оформления (`localStorage`, ключ `utils:theme`).
