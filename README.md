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

Остальные инструменты (JSON, Base64, QR, цвета, хеши, пароли, изображения, timestamp, regex, регистр, UUID)
заведены в реестре со статусом «скоро».

## Стек

| Что | Зачем |
| --- | --- |
| React 19 + TypeScript | интерфейс и типобезопасность |
| Vite 8 | сборка и dev-сервер |
| MobX 7 + mobx-react-lite | состояние (тема, редактор записи) |
| Tailwind CSS 4 + shadcn/ui (radix-nova) | стили и доступные компоненты |
| @breezystack/lamejs | кодирование MP3 в браузере |
| react-router-dom (HashRouter) | маршруты, совместимые с GitHub Pages |

## Команды

```bash
npm install       # установка зависимостей
npm run dev       # dev-сервер (http://localhost:5173/utils/)
npm run build     # типы + production-сборка в dist/
npm run preview   # локальный просмотр собранного сайта
npm run lint      # ESLint
npm run check     # проверка WAV/MP3-энкодеров, правок и сторов в Node
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
  lib/            форматирование, скачивание файлов, cn()
  stores/         RootStore (тема), контекст и провайдер
scripts/          check-encoders.ts, check-store.ts — проверки без браузера
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
  status: 'available',
  tags: ['json'],
  component: lazy(() => import('@/features/json-formatter/JsonFormatterPage')),
}
```

3. Маршрут `/tools/<slug>` и карточка на главной появятся автоматически.
   Пока инструмента нет, оставляйте `status: 'soon'` без `component`.

## Деплой на GitHub Pages

Репозиторий: `theHarald/utils`, адрес сайта — `https://theHarald.github.io/utils/`,
поэтому в `vite.config.ts` указан `base: '/utils/'`. Маршрутизация — `HashRouter`,
чтобы прямые ссылки на инструменты не давали 404.

Публикация автоматическая: `.github/workflows/deploy.yml` на каждый push в `main`
(и по кнопке **Run workflow**) прогоняет `npm run lint`, `npm run check`, `npm run build`
и выкладывает `dist/` через `upload-pages-artifact` → `deploy-pages`. Если любой шаг
красный, сайт не обновляется.

### Разовая настройка (делает владелец репозитория)

1. **Settings → Pages → Build and deployment → Source: `GitHub Actions`**.
   Выбирается одним дропдауном и сохраняется сразу — ветку и папку указывать не нужно.
2. **Settings → Environments**: после первого успешного деплоя появится окружение
   `github-pages`. Если в нём включены required reviewers, деплой нужно подтвердить.
3. **Actions → Deploy to GitHub Pages → Re-run all jobs** (или любой push в `main`) —
   workflow опубликует текущий `dist/`.

То же самое через API, если удобнее терминал (нужен PAT с доступом к репозиторию):

```bash
curl -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/theHarald/utils/pages \
  -d '{"build_type":"workflow"}'
```

Локальный прогон того же пайплайна перед пушем:

```bash
npm ci && npm run lint && npm run check && npm run build && npm run preview
```

Если репозиторий называется иначе, поменяйте `base` в `vite.config.ts` и `site.repoUrl`
в `src/app/site.ts`.

### Если workflow упал на шаге `configure-pages`

Ошибка `Get Pages site failed` / `404` значит, что Pages ещё не включён в настройках
репозитория — включите его (шаг 1 выше) и перезапустите workflow. Шаги `lint`, `check`
и `build` при этом уже зелёные, поэтому повторный прогон дойдёт до деплоя.

### Свой домен (опционально)

`public/CNAME` с доменом + DNS-запись `CNAME` на `theharald.github.io`, затем
**Settings → Pages → Custom domain**. После этого `HashRouter` можно оставить как есть,
а `base` заменить на `'/'` только если сайт переезжает в корень домена.

## Приватность

Все вычисления выполняются в браузере. Аудио не отправляется по сети: запись хранится в памяти
вкладки (`Float32Array`) и исчезает после перезагрузки страницы. Единственное, что сохраняется
между сессиями, — выбранная тема оформления (`localStorage`, ключ `utils:theme`).
