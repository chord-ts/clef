<div align="center">

# clef

**Swagger UI для OpenRPC — документация и живая консоль в одном файле с CDN**

<a href="https://svelte.dev"><img src="https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00"></a>
<a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white"></a>
<a href="https://opensource.org/license/MIT"><img src="https://img.shields.io/badge/License_MIT-228B22?style=for-the-badge"></a>

Нативный OpenRPC без конвертации в OpenAPI: методы, схемы и ошибки рендерятся как есть, а любой метод можно выполнить прямо из документации — по HTTP или WebSocket, с готовыми сниппетами curl и JS. Внутри Svelte 5, снаружи один самодостаточный файл (~44 КБ gzip): без React, MUI и внешних зависимостей.

</div>

## Подключение

Один тег `<script>` — и на странице доступны и функция `clef.mount`, и элемент `<clef-docs>`:

```html
<script src="https://cdn.jsdelivr.net/npm/@chord-ts/clef"></script>
<div id="docs" style="height: 100vh"></div>
<script>
  clef.mount('#docs', { url: '/openrpc.json', endpoint: '/rpc' });
</script>
```

Декларативный вариант, без JS-кода на странице:

```html
<clef-docs url="/openrpc.json" endpoint="/rpc" theme="auto" style="display: block; height: 100vh"></clef-docs>
```

Для сборщиков есть ESM-версия: `npm install @chord-ts/clef`, затем `import { mount } from '@chord-ts/clef'`. Типы публичного API идут в комплекте.

## Опции

| Опция | Что делает |
| --- | --- |
| `spec` | OpenRPC-документ объектом или JSON-строкой — инлайн, без fetch и CORS |
| `url` | URL документа; clef скачает его сам |
| `endpoint` | JSON-RPC эндпоинт: спека тянется через `rpc.discover`, адрес подставляется в Try it |
| `transport` | `'http'` (по умолчанию) или `'websocket'`; для WS адрес `http(s)://` автоматически заменяется на `ws(s)://` |
| `theme` | `'auto'` (по умолчанию), `'light'` или `'dark'` |
| `tryIt` | `false` прячет консоль — остаётся только документация |
| `requestTimeoutMs` | таймаут запроса, по умолчанию 15000 |

Источник спеки выбирается по приоритету `spec` → `url` → `endpoint`. Виджет занимает всю высоту контейнера (минимум 480px), поэтому контейнеру стоит задать высоту явно.

На узких экранах (≤900px) колонки превращаются в три листаемые панели: методы, документация, Try it. Кнопка с иконкой сайдбара в шапке документации уводит влево к списку методов, кнопка «Try it» — вправо к консоли; панели также листаются горизонтальными свайпами.

`mount()` возвращает хэндл: `update(options)` заменяет опции на лету, `destroy()` удаляет виджет. У `<clef-docs>` те же настройки через атрибуты (`url`, `endpoint`, `transport`, `theme`, `try-it`, `spec` — JSON-строка), а объектом спеку можно передать через свойство `element.spec`.

## Демо

```bash
pnpm demo:server
```

Поднимает mock JSON-RPC сервер на http://localhost:4000 — там же страница с собранным бандлом: переключатель источников спеки (url / rpc.discover / inline / web component) и тем. Все методы из демо-спеки реально исполняются, включая WebSocket.

Для разработки с HMR: `pnpm dev` → http://localhost:5173/demo/ (демо-сервер должен быть запущен).

## Разработка

```bash
pnpm install
pnpm test     # vitest: ядро + интеграция mount() в jsdom
pnpm check    # svelte-check
pnpm build    # dist/clef.iife.js + dist/clef.esm.js + типы
```

Ядро (`src/core`) не зависит от Svelte: загрузчик спеки, резолв `$ref`, JSON-RPC клиент и генерация примеров из JSON Schema покрыты тестами отдельно от UI. Компоненты (`src/components`) — руны Svelte 5, стили инлайнятся в бандл при сборке.

## Ограничения

- Спека только в JSON, YAML не поддерживается.
- `$ref` — только внутренние (`#/components/...`), внешние ссылки не резолвятся.
- Описания рендерятся как обычный текст, без Markdown.
- WebSocket-транспорт открывает отдельное соединение на каждый запрос.
- Для кросс-доменных запросов из Try it эндпоинт должен отдавать CORS-заголовки.

## Лицензия

MIT