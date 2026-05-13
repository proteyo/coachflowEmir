# CoachFlow Backend

Production-ready FastAPI + PostgreSQL бэкенд для приложения CoachFlow.

---

## Структура проекта

```
coachflow-backend/
├── app/
│   ├── main.py                 # FastAPI app, роутеры, CORS
│   ├── core/
│   │   ├── config.py           # Настройки из .env
│   │   ├── security.py         # bcrypt + JWT
│   │   └── deps.py             # FastAPI dependencies (auth guard)
│   ├── db/
│   │   ├── database.py         # Async SQLAlchemy engine + session
│   │   └── base.py             # DeclarativeBase + все импорты моделей
│   ├── models/                 # ORM модели (по одной на файл)
│   ├── schemas/                # Pydantic схемы (request/response)
│   ├── services/
│   │   └── mappers.py          # ORM → Pydantic конвертеры
│   └── routers/                # API роутеры
├── alembic/                    # Миграции
├── frontend-changes/           # Файлы для замены в Expo проекте
│   ├── constants/api.ts
│   └── src/
│       ├── services/api.ts
│       └── context/
│           ├── AuthContext.tsx
│           └── DataContext.tsx
├── seed.py                     # Демо-данные
├── requirements.txt
├── alembic.ini
└── .env.example
```

---

## Быстрый старт (Windows PowerShell)

### 1. Установи PostgreSQL
Скачай с https://www.postgresql.org/download/windows/  
Создай базу данных:
```sql
CREATE DATABASE coachflow;
```

### 2. Клонируй и настрой окружение
```powershell
cd coachflow-backend

# Создай виртуальное окружение
python -m venv .venv
.venv\Scripts\Activate.ps1

# Установи зависимости
pip install -r requirements.txt
```

### 3. Настрой .env
```powershell
Copy-Item .env.example .env
```
Открой `.env` и заполни:
```env
DATABASE_URL=postgresql+asyncpg://postgres:ВАШ_ПАРОЛЬ@localhost:5432/coachflow
SECRET_KEY=сгенерируй_длинную_строку_минимум_32_символа
```

Сгенерировать SECRET_KEY:
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

### 4. Примени миграции (или автосоздание таблиц)

**Вариант А — через Alembic (рекомендуется для продакшена):**
```powershell
alembic revision --autogenerate -m "initial"
alembic upgrade head
```

**Вариант Б — автосоздание при старте (разработка):**
Таблицы создаются автоматически при первом запуске.

### 5. Заполни демо-данными
```powershell
python seed.py
```
Создаст:
- 👨‍💼 Тренер: `coach@coachflow.kz` / `coach123`
- 👤 Клиент: `aigul@example.com` / `client123` (код: `CFL-AIGUL1`)
- 👤 Клиент: `damir@example.com` / `client123` (код: `CFL-DAMIR2`)

### 6. Запусти сервер
```powershell
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Документация API: http://localhost:8000/docs  
ReDoc: http://localhost:8000/redoc

---

## Подключение фронтенда

Скопируй файлы из `frontend-changes/` в твой Expo проект:

| Откуда (в этой папке) | Куда (в Expo проекте) |
|---|---|
| `frontend-changes/constants/api.ts` | `expo/constants/api.ts` |
| `frontend-changes/src/services/api.ts` | `expo/src/services/api.ts` |
| `frontend-changes/src/context/AuthContext.tsx` | `expo/src/context/AuthContext.tsx` |
| `frontend-changes/src/context/DataContext.tsx` | `expo/src/context/DataContext.tsx` |

### Настрой BASE_URL в `constants/api.ts`

| Устройство | URL |
|---|---|
| iOS симулятор | `http://localhost:8000/api/v1` |
| Android эмулятор | `http://10.0.2.2:8000/api/v1` |
| Физическое устройство (Expo Go) | `http://192.168.X.X:8000/api/v1` (IP твоего ПК) |

Узнать IP на Windows:
```powershell
ipconfig | findstr "IPv4"
```

---

## API эндпоинты

### Auth
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/v1/auth/register` | Регистрация |
| POST | `/api/v1/auth/login` | Вход |
| POST | `/api/v1/auth/refresh` | Обновить токен |
| GET | `/api/v1/auth/me` | Текущий пользователь |

### Users & Profiles
| Метод | Путь | Описание |
|---|---|---|
| GET/PATCH | `/api/v1/users/me` | Профиль пользователя |
| GET/PATCH | `/api/v1/users/me/coach-profile` | Профиль тренера |
| GET/PATCH | `/api/v1/users/me/client-profile` | Профиль клиента |
| GET/PATCH | `/api/v1/users/me/notifications` | Настройки уведомлений |

### Clients (тренер)
| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/v1/clients` | Мои клиенты |
| POST | `/api/v1/clients/link` | Привязать клиента по коду |
| GET | `/api/v1/clients/{id}` | Данные клиента |
| DELETE | `/api/v1/clients/{id}` | Отвязать клиента |

### Workouts
| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/v1/workouts` | Список тренировок |
| POST | `/api/v1/workouts` | Создать (тренер) |
| GET/PATCH/DELETE | `/api/v1/workouts/{id}` | Одна тренировка |
| POST | `/api/v1/workouts/{id}/complete` | Отметить выполненной |

### Supplements
| Метод | Путь | Описание |
|---|---|---|
| GET/POST | `/api/v1/supplements/plans` | Планы приёма |
| GET/PATCH/DELETE | `/api/v1/supplements/plans/{id}` | Один план |
| GET/POST | `/api/v1/supplements/logs` | Логи приёма |

### Progress, Messages, Weekly Goals, Attendance, Streak, Places, Subscriptions
Смотри http://localhost:8000/docs после запуска.

---

## Безопасность

- ✅ Пароли хешируются через **bcrypt** (rounds=12)
- ✅ JWT токены с коротким сроком жизни (60 мин) + refresh токен (30 дней)
- ✅ Role-based access: тренер видит только своих клиентов
- ✅ Клиент видит только свои данные
- ✅ CORS настраивается через .env
- ✅ Секреты только через .env, никаких хардкодов
- ✅ ForeignKey constraints + индексы на всех join-полях
- ✅ Pydantic валидация всех входящих данных
- ✅ Глобальный exception handler (не раскрывает стек)

---

## Продакшен деплой

1. Установи `SECRET_KEY` длиной 64+ символа
2. Смени `DATABASE_URL` на продакшен PostgreSQL
3. Настрой `CORS_ORIGINS` только на домен приложения
4. Запускай через gunicorn:
   ```bash
   gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
   ```
5. Используй Alembic для миграций (не автосоздание таблиц)
