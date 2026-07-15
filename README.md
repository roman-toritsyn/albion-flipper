# Albion Flipper

Вебдодаток для пошуку вигідних фліпів у [Albion Online](https://albiononline.com) (сервер Europe): купуєш спорядження в королівських містах або Caerleon і продаєш на **Black Market**.

Дані цін беруться з [Albion Online Data Project (AODP)](https://www.albion-online-data.com/). Додаток показує угоди з урахуванням податку (4% premium / 8%), якості (Q1–Q5), свіжості даних і мінімального прибутку.

## Що вміє

- Список фліпів місто → Black Market для BM gear **4.3–8.4**
- Сортування: найвигідніші / найсвіжіші
- Фільтри: місто, якість, податок, вік даних, поріг прибутку
- Збереження фільтрів і мови в `localStorage`
- Локалізація UI (українська + мови з dump Albion); для української назви предметів лишаються англійськими
- Кеш цін на сервері (~90 с), щоб не спамити AODP

## Технології

| | |
|---|---|
| Framework | [Next.js](https://nextjs.org/) 16 (App Router) |
| UI | [React](https://react.dev/) 19 |
| Мова | [TypeScript](https://www.typescriptlang.org/) |
| Стилі | [Tailwind CSS](https://tailwindcss.com/) 4 |
| Дані | [AODP Prices API](https://www.albion-online-data.com/) (Europe) |
| Назви предметів | [ao-bin-dumps](https://github.com/ao-data/ao-bin-dumps) |

Інших runtime-залежностей майже немає — лише Next і React.

## Вимоги

- **Node.js ≥ 20.9** (див. `.nvmrc` / `engines` у `package.json`)

## Запуск

```bash
npm install
npm run dev
```

Dev-сервер слухає [http://127.0.0.1:3000](http://127.0.0.1:3000).

Продакшн:

```bash
npm run build
npm start
```

## Корисні скрипти

| Команда | Призначення |
|---------|-------------|
| `npm run build:item-names` | Оновити багатомовні назви предметів з ao-bin-dumps |
| `npm run smoke:calc` | Перевірка формул профіту |
| `npm run smoke:aodp` | Смоук-запит до AODP |
| `npm run smoke:flips` | Смоук збору flips |
| `npm run smoke:cache` | Перевірка кешу |

## Ліцензія

Private — особистий / навчальний проєкт.
