# HelpDesk — стенд для практической работы № 4

Веб-приложение на Node.js (сервер без внешних runtime-зависимостей) и нативном JavaScript. Исходно стенд **умышленно содержал дефекты**; они найдены тестами и исправлены (см. раздел «Результаты»).

## Требования

- Node.js 20+ (рекомендуется Node.js 22), npm, современный браузер.
- Интернет при первом `npm install` для Jest и Cypress.

## Быстрый старт

```bash
npm install
npm start
```

Откройте http://127.0.0.1:3000. После перезапуска сервера данные возвращаются к четырем демонстрационным заявкам.

## Тесты

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:coverage
```

Для E2E **в отдельном терминале** запустите тестовый сервер:

```bash
npm run start:test
```

В другом терминале:

```bash
npm run e2e
# или интерактивно: npm run e2e:open
```

Тестовый сервер поддерживает `POST /api/__reset` для очистки состояния между E2E-кейсами. Он доступен **только** при `npm run start:test`; в обычном режиме не включен. Не используйте тестовый режим для реальной эксплуатации.

## API

| Метод | Путь | Назначение |
|---|---|---|
| GET | `/api/health` | Проверка доступности |
| GET | `/api/tickets?search=&status=&category=&priority=` | Поиск и список |
| POST | `/api/tickets` | Создание заявки |
| PATCH | `/api/tickets/:id/status` | Изменение статуса |
| POST | `/api/__reset` | Только для E2E тестового режима |

Пример создания:

```json
{
  "title": "VPN не работает",
  "description": "Не удается подключиться к учебной сети",
  "category": "network",
  "priority": "high"
}
```

Статусы: `new`, `in_progress`, `resolved`. Категории: `hardware`, `software`, `network`. Приоритеты: `low`, `medium`, `high`.

## Структура

- `src/core.js` — чистые функции, валидация, фильтрация, переходы статусов.
- `src/store.js` — хранилище в памяти.
- `src/app.js` — HTTP API и статические ресурсы.
- `public/` — пользовательский интерфейс.
- `tests/unit`, `tests/integration` — примеры тестов Jest.
- `cypress/pages`, `cypress/e2e` — Page Object и пример E2E.
- `.github/workflows/qa.yml` — CI: Jest (unit + integration + coverage) и Cypress E2E.
- `docs/helpdesk.feature` — BDD-сценарии Given/When/Then со ссылками на тесты.

## Результаты практической работы № 4

| Набор | Тестов | Исходный код (до TDD) | После исправлений и TDD |
|---|---|---|---|
| Unit (Jest) | 30 | 7 из 29 упало | 30 / 30 |
| Integration (Jest) | 16 | 5 из 14 упало | 16 / 16 |
| E2E (Cypress) | 7 | E-01 (сортировка), E-06 (XSS) падают | 7 / 7 |

### Найденные дефекты

| ID | Требование | Тест (RED) | Причина | Исправление (коммит) |
|---|---|---|---|---|
| D1 | Тема: схлопывание пробелов, длина после нормализации | U-02, U-03, I-03, I-04 | `normalizeTitle` делал только `trim()`, валидация мерила «сырую» строку | `fix(D1-D4)` — `src/core.js` |
| D2 | Переходы только new→in_progress→resolved | U-06, I-10 | разрешён `new → resolved` | `fix(D1-D4)` — `src/core.js` |
| D3 | Сортировка high → medium → low | U-07, I-09, E-01 | компаратор `a - b` вместо `b - a` | `fix(D1-D4)` — `src/core.js` |
| D4 | Поиск без учёта регистра | U-08, U-09, I-08 | `includes` без `toLowerCase()` | `fix(D1-D4)` — `src/core.js` |
| D5 | HTML из ввода — как текст | E-06 | вывод через `innerHTML` (XSS) | `fix(D5)` — `public/app.js` |

### TDD: фильтр по приоритету

1. RED — `test(TDD RED)`: T-01, T-02, T-03, E-07 падают (параметр `priority` игнорируется).
2. GREEN — `feat(TDD GREEN)`: `src/core.js`, `src/app.js`, `public/index.html`, `public/app.js`.
3. REFACTOR — `refactor(TDD)`: таблица переходов `TRANSITIONS`, общий фильтр по полям `EXACT_FILTERS`; полный регрессионный набор зелёный.

### CI

GitHub Actions: https://github.com/ilaisit2b/practice4-helpdesk/actions — workflow «HelpDesk autotests» (Jest + Cypress) запускается на каждый push и pull request. В истории коммитов видно: RED после добавления тестов → GREEN после `fix(D1-D4)` и `fix(D5)` → RED на `test(TDD RED)` → GREEN на `feat(TDD GREEN)`.
