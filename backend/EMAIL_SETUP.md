# SMTP-почта CoachFlow

Отправка писем отключена по умолчанию: `EMAIL_ENABLED=false`. Подтверждённые аккаунты продолжают входить. Регистрация и восстановление не обходят проверку почты: при попытке отправки возвращается ошибка о временном отключении писем.

Для тестирования созданы отдельные подтверждённые аккаунты тренера и клиента. Для них письма не нужны.

После перехода web service на платный тариф Render можно включить Gmail SMTP:

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USE_SSL=false
SMTP_USER=your-address@gmail.com
SMTP_PASSWORD=your-new-google-app-password
SMTP_FROM=CoachFlow <your-address@gmail.com>
SMTP_TIMEOUT_SECONDS=20
ALLOW_EMAIL_CONSOLE_FALLBACK=false
FRONTEND_RESET_URL=coachflow://reset-password
```

Нужен пароль приложения Google. Для SSL на порту 465 используются `SMTP_USE_SSL=true` и `SMTP_USE_TLS=false`; оба режима одновременно не включаются.

На бесплатном web service Render SMTP-порты 465 и 587 заблокированы, поэтому включение переменной само по себе не восстановит доставку: https://render.com/docs/free.

Интеграция Resend удалена. Переменные `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TIMEOUT_SECONDS` больше не читаются приложением. Их можно удалить в Render Environment; неиспользуемый ключ — отозвать в кабинете Resend.

Перед включением для пользователей нужно проверить подтверждение и восстановление на собственном реальном адресе. В Expo Go токен восстановления можно вставить вручную; схема `coachflow://` предназначена для установленной сборки приложения.
