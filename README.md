# WB-Box Application

## TL;DR

Скопируйте структуру из `.env.example` в `.env`

Данный проект использует сервисный аккаунт для чтения / записи. Разместите файл `keys/key.json`

Миграции накатываются автоматически при старте.

Синхронизация стоит раз в час, отключить можно используя ключ `SCHEDULER_ENABLED`

Разделитель дробей можно указать в env, так же как и поле сортировки:

`EXPORT_DECIMAL_SEPARATOR=","`
`EXPORT_SORTING_COLUMN="boxDeliveryCoefExpr"`
`EXPORT_SORTING_ASC=1`

По умолчанию: boxDeliveryCoefExpr по возрастанию, запятая для десятичных дробей.

Каждый час таблица обновляется на актуальные данные.

Реализованы запуски синхронизации как через cli, так и через http.

**Политика повторных попыток:**
- Wildberries API: 3 попытки с экспоненциальной задержкой (2с, 4с, 8с)
- Google Sheets API: 3 попытки с экспоненциальной задержкой (1с, 2с, 4с)

---

NestJS приложение с Knex.js и PostgreSQL для управления тарифными данными.

## Требования

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (для локальной разработки без Docker)

## Установка

```bash
npm install
```

## Настройка Google Service Account

Разместите файл ключа Google service account в директории `keys/`:

```bash
# keys/key.json должен содержать учетные данные вашего Google service account
```

Убедитесь, что сервисный аккаунт имеет доступ к Google Spreadsheets, указанным в `GOOGLE_SPREADSHEETS`.

## Переменные окружения

Создайте файл `.env` в корневой директории:

```env
# HTTP Server
HTTP_PORT=3000

# Database
PG_HOST=localhost
PG_PORT=5432
PG_DB=db
PG_USER=postgres
PG_PASS=postgres

# Wildberries API
WB_API_TOKEN=your_wildberries_api_token

# Google Sheets Integration
GOOGLE_SPREADSHEETS=["spreadsheet_id_1", "spreadsheet_id_2"]
GOOGLE_SERVICE_ACCOUNT_KEYFILE=key.json

# Export settings
EXPORT_DECIMAL_SEPARATOR=","
EXPORT_SORTING_COLUMN="boxDeliveryCoefExpr"
EXPORT_SORTING_ASC=1

# Scheduler
SCHEDULER_ENABLED=1
```

## Настройка базы данных

### Использование Docker Compose (Рекомендуется)

```bash
# Запуск всех сервисов (база данных + приложение)
docker-compose up

# Запуск в фоновом режиме
docker-compose up -d

# Остановка сервисов
docker-compose down

# Остановка и удаление volumes
docker-compose down -v
```

### Локальная разработка

1. Запустите PostgreSQL локально
2. Создайте базу данных:
```bash
createdb db
```

3. Выполните миграции:
```bash
npm run migrate:latest
```

## Запуск приложения

### Режим разработки
```bash
npm run start:dev
```

### Продакшн режим
```bash
npm run build
npm run start:prod
```

### Docker режим
```bash
docker-compose up
```

## Миграции базы данных

```bash
# Выполнить последние миграции
npm run migrate:latest

# Откатить последнюю миграцию
npm run migrate:rollback

# Создать новую миграцию
npm run migrate:make migration_name
```

## Интеграция с Wildberries API

### CLI команда - Синхронизация тарифов

Ручная синхронизация тарифных данных с Wildberries API:

```bash
# Синхронизация тарифов на сегодня (и экспорт в Google Sheets)
npm run sync-tariffs

# Синхронизация тарифов на конкретную дату (формат: YYYY-MM-DD) и экспорт
npm run sync-tariffs 2025-11-30
```

**Возможности:**
- Автоматически обрабатывает "уродливый" формат API (запятые в десятичных разделителях, '-' вместо null)
- Если запись существует: обновляет tariff_dates и заменяет все записи warehouse
- Если запись не существует: создает новую tariff_dates и вставляет записи warehouse
- Использует транзакции базы данных для обеспечения целостности данных
- **Автоматически экспортирует в Google Sheets после успешной синхронизации**

### API эндпоинты - Синхронизация тарифов

Вы также можете синхронизировать через HTTP эндпоинты:

```bash
# Синхронизация тарифов на сегодня (и экспорт в Google Sheets)
curl -X POST http://localhost:3000/tariffs/sync

# Синхронизация тарифов на конкретную дату (и экспорт в Google Sheets)
curl -X POST http://localhost:3000/tariffs/sync/2025-11-30
```

**Примечание:** Эндпоинты синхронизации автоматически экспортируют в Google Sheets после успешной синхронизации.

## Автоматический планировщик

Приложение включает автоматический почасовой планировщик, который синхронизирует тарифы и экспортирует их в Google Sheets.

### Конфигурация

Включить/отключить планировщик через переменную окружения:

```env
# Включить планировщик (по умолчанию)
SCHEDULER_ENABLED=1

# Отключить планировщик
SCHEDULER_ENABLED=0
```

### Расписание

- **Частота**: Каждый час в 0-ю минуту (например, 10:00, 11:00, 12:00 и т.д.)
- **Действие**: Синхронизирует тарифы на текущую дату с Wildberries API и экспортирует в Google Sheets
- **Логирование**: Все запланированные запуски логируются со статусом успеха/неудачи

### Ручное управление

Вы можете запускать ручную синхронизацию через CLI или HTTP эндпоинты даже при включенном планировщике.

## Экспорт в Google Sheets

### CLI команда - Экспорт в Google Sheets

Экспорт тарифных данных в Google Sheets:

```bash
# Экспорт всех тарифных данных
npm run export-tariffs

# Экспорт тарифных данных для конкретной даты
npm run export-tariffs 2025-11-30
```

**Возможности:**
- Экспортирует данные со структурой: `updated_at`, свойства главной таблицы, LEFT JOIN свойства дочерней таблицы
- Сортировка по `boxDeliveryCoefExpr` (по возрастанию, null в конце)
- Использует запятую как десятичный разделитель (настраивается через `EXPORT_DECIMAL_SEPARATOR`)
- Очищает существующие данные и перезаписывает их
- Задержка 500мс между экспортами в несколько таблиц
- Экспортирует во все таблицы, настроенные в `GOOGLE_SPREADSHEETS`

### API эндпоинт - Экспорт в Google Sheets

Вы также можете экспортировать через HTTP эндпоинт:

```bash
# Экспорт всех тарифных данных
curl -X POST http://localhost:3000/tariffs/export

# Экспорт тарифных данных для конкретной даты
curl -X POST "http://localhost:3000/tariffs/export?date=2025-11-30"
```

## API эндпоинты

### Главный эндпоинт
- `GET /tariffs?date=YYYY-MM-DD` - Получить тарифные данные со всеми связями warehouse для конкретной даты

Пример:
```bash
curl http://localhost:3000/tariffs?date=2025-11-30
```

Ответ:
```json
{
  "date": "2025-11-30",
  "dtNextBox": "2025-12-01",
  "dtTillMax": "2025-12-31",
  "created_at": "2025-11-30T10:00:00.000Z",
  "updated_at": "2025-11-30T14:00:00.000Z",
  "warehouses": [
    {
      "tariff_date": "2025-11-30",
      "boxDeliveryBase": 1.234,
      "boxDeliveryLiter": 5.678,
      "boxStorageBase": 2.345,
      "boxStorageLiter": 3.456,
      "warehouseName": "Warehouse Name",
      "geoName": "Location",
      ...
    }
  ]
}
```

### Тарифные даты (Только чтение)
- `GET /tariffs/dates` - Получить все тарифные даты
- `GET /tariffs/dates/:date` - Получить тарифную дату по дате

### Тарифные склады (Только чтение)
- `GET /tariffs/warehouses` - Получить все склады
- `GET /tariffs/warehouses/:date` - Получить склады по дате

### Синхронизация Wildberries API (Только администратор)
- `POST /tariffs/sync` - Синхронизировать тарифы на сегодня из Wildberries API
- `POST /tariffs/sync/:date` - Синхронизировать тарифы на конкретную дату из Wildberries API

### Экспорт в Google Sheets (Только администратор)
- `POST /tariffs/export` - Экспортировать все тарифные данные в Google Sheets
- `POST /tariffs/export?date=YYYY-MM-DD` - Экспортировать тарифные данные для конкретной даты в Google Sheets

**Примечание безопасности:** API доступен только для чтения. Создание, обновление и удаление данных возможно только через синхронизацию с Wildberries API для предотвращения неправильного использования данных.

## Схема базы данных

### tariff_dates
- `date` (DATE, PK) - Основная дата
- `dtNextBox` (DATE, nullable) - Дата следующей коробки
- `dtTillMax` (DATE, nullable) - Максимальная дата до
- `created_at` (TIMESTAMP) - Дата создания
- `updated_at` (TIMESTAMP) - Дата обновления

### tariff_warehouses
- `tariff_date` (DATE, FK) - Внешний ключ к tariff_dates
- `boxDeliveryBase` (DECIMAL, nullable)
- `boxDeliveryCoefExpr` (DECIMAL, nullable)
- `boxDeliveryLiter` (DECIMAL, nullable)
- `boxDeliveryMarketplaceBase` (DECIMAL, nullable)
- `boxDeliveryMarketplaceCoefExpr` (DECIMAL, nullable)
- `boxDeliveryMarketplaceLiter` (DECIMAL, nullable)
- `boxStorageBase` (DECIMAL, nullable)
- `boxStorageCoefExpr` (DECIMAL, nullable)
- `boxStorageLiter` (DECIMAL, nullable)
- `geoName` (VARCHAR(512), nullable)
- `warehouseName` (VARCHAR(512), nullable)
- `created_at` (TIMESTAMP) - Дата создания
- `updated_at` (TIMESTAMP) - Дата обновления

## Тестирование

```bash
# Юнит тесты
npm run test

# E2E тесты
npm run test:e2e

# Покрытие тестами
npm run test:cov
```

## Лицензия

UNLICENSED
