# Albion Flipper

Вебдодаток для пошуку вигідних фліпів у [Albion Online](https://albiononline.com) (сервер Europe).

Дані цін — [Albion Online Data Project (AODP)](https://www.albion-online-data.com/).

## Що вміє

### BM Flips (`/`)
- Фліпи місто → Black Market для BM gear **4.3–8.4**
- Сортування: найвигідніші / найсвіжіші
- Фільтри: місто, якість, податок, вік даних, поріг прибутку

### Craft → BM (`/craft`)
- Купуєш готові інгредієнти на ринку (найдешевше місто), крафтиш **плащі** (crested/FW) або **royal**, продаєш на Black Market
- Без барів/тканини/рун/focus — лише market-combine рецепти
- Breakdown інгредієнтів з містом покупки
- Окреме збереження фільтрів у `localStorage`

### Загальне
- Збереження фільтрів і мови в `localStorage`
- Локалізація UI; для української назви предметів англійські
- Серверний кеш цін (~90 с)

## Технології

| | |
|---|---|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| UI | [React](https://react.dev/) 19 |
| Мова | [TypeScript](https://www.typescriptlang.org/) |
| Стилі | [Tailwind CSS](https://tailwindcss.com/) 4 |
| Дані | [AODP Prices API](https://www.albion-online-data.com/) (Europe) |
| Назви / рецепти | [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps) |

## Вимоги

- **Node.js ≥ 20.9**

## Запуск

```bash
npm install
npm run dev
```

Dev: [http://127.0.0.1:3000](http://127.0.0.1:3000) · Craft: [http://127.0.0.1:3000/craft](http://127.0.0.1:3000/craft)

```bash
npm run build
npm start
```

## Корисні скрипти

| Команда | Призначення |
|---------|-------------|
| `npm run build:item-names` | Оновити багатомовні назви (items + craft) |
| `npm run build:craft-recipes` | Оновити craft-рецепти з items.xml |
| `npm run smoke:calc` | Формули профіту |
| `npm run smoke:craft-recipes` | Перевірка craft-recipes.json |
| `npm run smoke:craft-flips` | Фікстури craftFlips |
| `npm run smoke:craft-api` | Live AODP + craft flips |
| `npm run smoke:aodp` | Смоук AODP |
| `npm run smoke:flips` | Смоук BM flips |
| `npm run smoke:cache` | Кеш |

## Ліцензія

Private — особистий / навчальний проєкт.
