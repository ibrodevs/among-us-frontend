# Реальная проверка игры — 16 ноября 2026

Ветки команды сохранены. Рабочие изменения находятся в `ai/frontend-stage-a` и `ai/frontend-gameplay`, backend — `ai/backend-stage-a` и `ai/backend-gameplay`. Main не менялся. PR этапа A: frontend #3, backend #4. Игровой backend: #5, commit `0a6b49418a4fba4d9630d11ec8dab069953a1bd5`.

## Что проверено локально

| Проверка | Результат |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, без предупреждений после исправления конфигураций |
| `npm run test` | 8 PASS: физика, камера, ввод, отбрасывание старых snapshots |
| `npm run build` | PASS, Next.js 15.5.29, React19 |
| `npm audit --audit-level=moderate` | 0 уязвимостей, Next15 сохранён, PostCSS обновлён через override |
| `playwright test --grep 'responsive\|4 real browsers'` | 2 PASS: 1440/768/390/360px, настоящий touch, матч4, offline→reconnect, восстановление роли, победа экипажа |
| `playwright test --grep '10 real browsers'` | PASS: 10 независимых browser contexts, одновременное движение, reconnect, два собрания, победа экипажа |
| `playwright test --grep 'all three real task'` | PASS: три мини-игры у терминалов, убийство, Report, Skip, правильный cooldown после собрания, победа предателя |
| Backend `manage.py test` | 67 PASS на PostgreSQL16, без пропусков |
| Backend migration drift / `check --deploy` / `pip check` | PASS |
| `scripts/check_map.py` | JSON карты совпадает байт-в-байт |

Все E2E выполняются против настоящих Daphne, отдельного игрового clock worker, PostgreSQL16 и Redis. Frontend запускается через production build и `npm start`. Моки REST/WS в этих сценариях не используются. Backend CI на указанном commit: [успешный run](https://github.com/ibrodevs/among-us-backend/actions/runs/43889918668). Статус frontend CI нужно смотреть в игровом PR после push.

Матч10: 103700мс включая22с ожидания реального guest rate limit, по685–686 snapshots на клиент, 0 pageerror. Это короткий функциональный прогон одной комнаты, а не доказательство многокомнатной нагрузки, отсутствия утечек памяти при длительной работе или production SLA.

## Исправления, обнаруженные именно E2E

- Серверные spawn points не совпадали со стенами карты: введён общий JSON.
- При десяти клиентах создание нового DB-соединения на каждый вызов создавало очередь ввода до5с: введён bounded psycopg pool, сокращён запрос членства, остановлена повторная отправка нулевого ввода. Повторный матч10 прошёл.
- После собрания приватный cooldown оставался старым в UI: clock теперь отправляет приватное состояние при возобновлении игры. Повторный сценарий убийств прошёл.
- Выход из активного матча теперь204 и серверный пересчёт победы; состояние и роли сохраняются в истории.
- Две вкладки и членство в разных комнатах учитываются отдельными connection leases.

Скриншоты настоящего приложения находятся в `screenshots/`, sanitized результаты матчей — `match-4.json`, `match-10.json`. Файлы Playwright trace с кадрами auth не публикуются. Nunito: SIL OFL в `/public/licenses/Nunito-OFL.txt`; SVG роботов и исходная Canvas-графика оригинальные.

## Оставшиеся внешние ворота

- Ревью второго участника и согласованное слияние PR: не выполнены; самостоятельно одобрять свои изменения нельзя.
- Публичная публикация: нет утверждённого backend сервера/домена и production окружения. Реальных опубликованных URL нет.
- Docker/Compose, TLS, backup/restore и rollback подготовлены в backend, но не проверены на выбранном production сервере.
- Длительный soak test, ограничение общего числа комнат и многокомнатный performance budget требуют отдельной проверки перед масштабированием.

Кандидат играбелен и проверен локально. Полная production готовность не заявляется до прохождения этих ворот.
