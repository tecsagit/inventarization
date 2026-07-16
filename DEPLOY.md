# Деплой: Supabase + Render

## 1. Supabase (проєкт `invent`)

1. Відкрий **SQL Editor** → встав вміст `supabase/schema.sql` → **Run**.
2. Відкрий **Project Settings → API** і скопіюй:
   - **Project URL** → `https://tuntrnuionupsrzgdjdl.supabase.co`
   - **anon public** key

## 2. GitHub

Репозиторій: https://github.com/tecsagit/inventarization

Код уже має бути в `main`. Якщо ні — з папки проєкту:

```bash
git init
git add .
git commit -m "Initial inventory app with Supabase"
git remote add origin https://github.com/tecsagit/inventarization.git
git branch -M main
git push -u origin main
```

## 3. Render — **Static Site**, не Web Service

На скріншоті зараз **Web Service** (Python/gunicorn) — для цього застосунку він **не потрібен**.

Створи **Static Site**:

| Поле | Значення |
|------|----------|
| Repository | `tecsagit/inventarization` |
| Branch | `main` |
| Build Command | `node scripts/generate-config.mjs` |
| Publish Directory | `.` |

**Environment Variables** (Render → Environment):

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://tuntrnuionupsrzgdjdl.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key з Supabase |

Після деплою сайт буде на `https://inventarization.onrender.com` (або схожа назва).

## 4. Перший запуск

- Якщо Supabase порожній — застосунок сам завантажить дані з `seed-data.js`.
- Якщо в браузері вже є localStorage — на хостингу це не використовується; дані лише в Supabase.

## 5. Імпорт / оновлення даних на сайті

Якщо на сайті не вистачає предметів, виконай повний імпорт з `inventory-import.json`:

```bash
SUPABASE_URL=https://tuntrnuionupsrzgdjdl.supabase.co \
SUPABASE_ANON_KEY=your_publishable_key \
node scripts/import-to-supabase.mjs inventory-import.json
```

Або через Python (якщо немає Node.js) — попроси асистента виконати імпорт.

Після деплою застосунок також автоматично додає **відсутні** предмети з `seed-data.js` при відкритті сайту.


```bash
copy config.example.js config.js
# встав URL і anon key
```

Відкрий `index.html` або запусти `Запуск.bat`.

Без `config.js` з ключами — працює локальний режим (localStorage).
