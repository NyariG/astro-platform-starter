# CLAUDE.md — Nyári Terv (`nyariterv.hu`)

Astro 5 + TypeScript + Tailwind v4, `@astrojs/netlify` serverless adapter (Node Lambda, ~10 s timeout).
Perzisztencia: **Netlify Blobs** (nincs SQL). Nyelv: magyar. Időzóna: Europe/Budapest.

## Fejlesztői parancsok

```
npm run dev            # helyi fejlesztés (.env-ből olvas)
npm run build          # SSR build (Netlify function)
npx tsc --noEmit       # típusellenőrzés
npx vitest run         # teljes teszt-suite
```

## Konvenciók

- **Nincs kód-komment** a modul fájljaiban (kifejezett elvárás).
- Titkok kizárólag env-ben (`.env` lokál, Netlify env éles) — soha a repóban. `PUBLIC_` prefix TILOS.
- Env-olvasás egységesen `readEnv(name)` (`src/utils/ajanlat/store.ts`): előbb `process.env`, majd `import.meta.env`.
- Magyar felhasználói szövegek, magyar függvény-/változónevek.

## `/ajanlat` árajánlat-modul (kész, éles)

- Beküldés: `POST /api/ajanlat` → validáció (zod) → árazás → Blobs mentés → PDF → 2 e-mail → Telegram-ping.
- **PDF**: éles a beépített pdf-lib generátor (`pdf/beepitett-pdf.ts`), DejaVu Serif, banner+footer, `aktuális/összes` oldalszám.
- **E-mail**: SMTP2GO `fetch`-en át (`email.ts`). Admin + ügyfél levél függetlenül megy; `DEBUG_EMAIL_TO` bcc teszthez.
- **Kvóták**: e-mailenként napi 1 ajánlat; IP-limit másodlagos fék (`QUOTE_IP_LIMIT`).
- Kupon: `POST /api/kupon`; sablon-seed: `POST /api/ajanlat-sablon-seed` (gate: `SABLON_SEED_TOKEN`).

## Telegram admin-bot — Iteráció 1 (kész, aktiválásra vár)

Kétirányú bot-alap. **Csak váz** — konkrét admin-vezérlő üzleti logika NINCS (TODO-slotok a jövőnek).
Serverless → **webhook** (nem long-polling).

### Fájlok
- `src/utils/ajanlat/telegram.ts` — `TelegramService`: `sendMessage`, `answerCallbackQuery`, retry+backoff, `telegramKonfiguralva()`.
- `src/utils/ajanlat/telegram-store.ts` — Blobs (`telegram` store): admin link/unlink/isAdmin/listAdmins, egyszer használatos link-token (10 perc, atomi `onlyIfMatch`), update-dedup (`markUpdateProcessed`), rate-limit (20/perc/chat).
- `src/utils/ajanlat/telegram-router.ts` — `kezelUpdate` (dedup) → parancsok `/start /help /link /unlink /status`, auth-middleware (`isAdmin`), inline gombok, callback-kezelés, TODO-slotok, `ertesitsUjAjanlat(record)` best-effort admin-értesítő.
- `src/pages/api/telegram/[titok].ts` — webhook: titkos path + `X-Telegram-Bot-Api-Secret-Token` fejléc; mindig gyors 200.
- `src/pages/api/telegram-link.ts` — kapuzott (`SABLON_SEED_TOKEN` Bearer, DEV nyitva): egyszer használatos deep-linket ad.
- `scripts/telegram-setwebhook.mjs` — webhook regisztráció a Bot API-nál.
- Bekötés: `src/pages/api/ajanlat.ts` — `ertesitsUjAjanlat` a beküldés után, try/catch, soha nem blokkol.

### Env (lásd `.env.example`)
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_PATH`, `TELEGRAM_WEBHOOK_SECRET`.

### Aktiválás
1. `@BotFather` → token + username; Netlify env-be a 4 `TELEGRAM_*` változó (webhook path/secret: hosszú véletlen).
2. Deploy után egyszer: `TELEGRAM_BOT_TOKEN=… TELEGRAM_WEBHOOK_SECRET=… TELEGRAM_WEBHOOK_PATH=… node scripts/telegram-setwebhook.mjs https://nyariterv.hu`
3. Admin összekötése: `POST /api/telegram-link` (`Authorization: Bearer <SABLON_SEED_TOKEN>`) → a kapott `t.me/...` linket megnyitni Telegramban → `/start` beváltja.
4. Ellenőrzés: `/status`. Több admin támogatott; leválasztás `/unlink`.

### Tesztek
`telegram.test.ts` (TelegramService, mockolt fetch), `telegram-router.test.ts` (dispatch/auth/idempotencia/értesítő, mockolt telegram+store). A Blobs-függő `telegram-store.ts` — mint a többi Blobs-kód — nincs unit-tesztelve (Netlify-kontextus kell).

## Munkamódszer

Fázis-kapus: FÁZIS 0 (read-only feltárás) → D1 (terv jóváhagyás) → D2 (implementáció jóváhagyás) → kód.
Döntési pontnál natív választó (AskUserQuestion), nem HTML.

## Definition of Done (Telegram Iteráció 1)

- [x] Webhook-alap + secret path + secret_token fejléc, mindig 200.
- [x] Biztonságos admin↔bot összekötés (egyszer használatos, lejáró token; atomi beváltás).
- [x] Parancsrouter + auth + alapparancsok magyarul + inline gombok + TODO-slotok.
- [x] Update-dedup (idempotencia), per-chat rate-limit, retry+nem-blokkoló API-hívás.
- [x] Best-effort új-ajánlat értesítő az adminoknak.
- [x] `tsc` tiszta, `vitest` zöld (396), `build` sikeres, `.env.example` frissítve.
- [ ] Éles env beállítva + `setWebhook` lefuttatva + első admin összekötve (üzemeltetői lépés).
