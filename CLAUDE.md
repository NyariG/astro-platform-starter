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

## SEO és blog

- `Layout.astro` adja minden oldalnak a kanonikus címet (perjellel végződő), az OG/Twitter metát, az opcionális `noindex`-et és a JSON-LD-t (`semak` prop). Sémák: `src/utils/seo.ts`.
- Sitemap: `@astrojs/sitemap` → `/sitemap-index.xml`; `public/robots.txt`; `/rss.xml`; `/llms.txt` (AI-keresőknek, a cikkek „Röviden” mezőjéből).
- Blog: content collection (`src/content/blog/*.md`, séma: `src/content.config.ts`, kategóriák és szerző: `src/data/blog.ts`). Új cikk: frontmatter `cim`, `leiras` (50–165 karakter), `kategoria`, `megjelent`, ajánlott `roviden` (2–3 mondatos közvetlen válasz), `gyik` (FAQPage-séma), `kep`, `ogKep` (1200×630 PNG a `public/images/blog/` alatt).
- Belső linkek perjellel végződjenek (`/blog/`, `/energetikai-tanusitvany/`), mert a Netlify a perjel nélküli URL-t 301-gyel irányítja át.
- Domain-átirányítás: `public/_redirects` (hitelesenergetikaitanusitvany.hu → `/energetikai-tanusitvany/`).

## Energetikai tanúsítvány árajánlatkérő (`/energetikai-tanusitvany/#arajanlat`)

- Űrlap: `src/components/TanusitvanyArajanlat.astro` (vanilla JS, élő ár). Végpont: `POST /api/tanusitvany-ajanlat`. Logika: `src/utils/tanusitvany/` (`arazas.ts` alapdíjak + kiszállás, `schema.ts` zod, `uzenetek.ts` levelek/Telegram, `kuldes.ts` SMTP2GO + Telegram + napi 5/IP limit a `tanusitvany` Blobs-store-ban).
- Árak: lakás 30 000, sorház 35 000, egyszintes ház 35 000, többszintes ház 42 000 Ft; 200 m² felett egyedi. Kiszállás: Abdától közúton 15 km-ig 0, felette minden megkezdett 5 km 2000 Ft. A szerver mindig újraszámol.
- Távolságok: `src/data/telepulesek-abda.json` (753 település, 100 km-es kör, OSM/OSRM, egyszer generálva: `node scripts/tanusitvany-telepulesek.mjs`). Listán kívüli település: egyedi ár.
- Az `/ajanlat` modulból csak meghív (`sendMessage`, `listAdmins`, `readEnv`, `hashIp`, `dateKey`), nem módosítja.
- Env: `TANUSITVANY_NOTIFY_EMAIL` (alapértelmezés: tanusitvany@nyariterv.hu), opcionális `TANUSITVANY_SENDER_EMAIL` (különben `QUOTE_SENDER_EMAIL`).

## Tágulási tartály méretező (`/tagtartaly-meretezo/`)

- Oldal: `src/pages/tagtartaly-meretezo.astro`, komponens: `src/components/TagtartalyMeretezo.astro` (vanilla JS, `?tipus=futes|ivoviz`). Cikk: `src/content/blog/tagtartaly-meretezese.md`.
- Logika: `src/utils/tagtartaly/szamitas.ts` (fűtés: MSZ EN 12828 szerinti `Vmin = (ΣVe + Vbizt)·(pe+1)/(pe−p0)`; HMV: Flamco Airfix-eljárás `Vn = Ve/(η·m)`; a hőtágulás a víz sűrűségtáblájából), `ajanlas.ts` (legkisebb megfelelő tartály: térfogat ≥ Vmin, PS ≥ psv, hőmérséklet), tesztek: `tagtartaly.test.ts`.
- Fűtés: egy kör (víztérfogat, leghidegebb és legmelegebb hőmérséklet, opcionális töltési hőmérséklet); a tágulás a sűrűségarányból (ρ(hideg)/ρ(meleg) − 1). Előfeszítés: p0 = h/10 + legalább 0,5 bar (hogy a legmagasabb ponton hidegen se essen 0,5 bar alá), **0,1 bar-ra** felfelé kerekítve (helyszínen könnyen beállítható érték). Végnyomás: fűtésnél pe = psv − max(0,1·psv; 0,5 bar); ivóvíznél pe = 0,9·psv. A hideg nyomás és a töltési nyomás a gáztörvényből jön az ajánlott tartály térfogatával (a tartályban hidegen a Vbizt víztartalék van; Vn = Vmin esetén a legmelegebb állapot nyomása pontosan pe, nagyobb tartálynál kisebb; a legmelegebb vízzel töltve ez a töltési nyomás). Nincs külön „pa ≥ p0 + 0,3 bar” feltétel, a Vmin csak a tanult képlet. A felület manométert rajzol (zöld üzemi, sárga pe–psv, piros psv fölött).
- Termékadat: `src/data/tagtartalyok.json`, csak gyártói/magyar katalógusban igazolt, független ügynökkel is ellenőrzött sorok (Reflex N/NG/Refix DD/DT, Flamco Contra-Flex/Flexcon R/Top/Airfix A/D, Gitral MB, Aquasystem VR). Ellentmondó forrásnál a kisebb PS szerepel. Bővítés előtt a ps és p0Gyari értékeket gyártói forrással ellenőrizni kell.
- A vitest Git Bash alól a meghajtóbetű kis/nagybetűs eltérése miatt elszáll, **PowerShellből** futtatandó.

- Képletek: KaTeX. A blogcikkekben `$...$` / `$$...$$` (remark-math + rehype-katex, `astro.config.mjs`); a méretező komponensben `katex.renderToString` (build-időben és a kliens oldali számolásnál is). Új képletet mindig LaTeX-ben írj, sima szövegként (pl. `p0`, `Vmin`) ne.

## Kapcsolati űrlap és adatkezelés

- `Contact.astro` → `POST /api/kapcsolat` (`src/utils/kapcsolat.ts`, zod, SMTP2GO a `tanusitvany/kuldes.ts` `emailKuldes`-én át, napi 5/IP a `kapcsolat` Blobs-store-ban). Címzett: `KAPCSOLAT_NOTIFY_EMAIL` (alap: info@nyariterv.hu). Külső űrlapszolgáltatás (formsubmit) nincs.
- Egyetlen adatkezelési tájékoztató van: `/adatkezelesi` (`src/pages/adatkezelesi.astro`), erre mutat minden űrlap, a lábléc, a sütibanner és az `/ajanlat` is. Új űrlapnál vagy adatfeldolgozónál ezt kell bővíteni.

## `/ajanlat` árajánlat-modul (kész, éles)

- Beküldés: `POST /api/ajanlat` → validáció (zod) → árazás → Blobs mentés → PDF → 2 e-mail → Telegram-ping.
- **PDF**: éles a beépített pdf-lib generátor (`pdf/beepitett-pdf.ts`), DejaVu Serif, banner + kontakt-footer minden oldalon (bal: kattintható `www`/`info` link, közép: NT-ikon + `aktuális/összes` oldalszám, jobb: név/tel/cím). Az aláírás-blokk **lapított raszter** (`alairas-blokk-b64.ts`, ImageMagick-kel offline sütve a repó DejaVu fontjából + `src/assets/alairas.png` 75%-os rárétegzés) → szövegréteg nélkül nem másolható; az `alairas.png` csak ebben a kompozitban él (nincs önálló kép-objektum). pdf-lib nem tud permission-flaget, ez tudatos korlát.
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

## Telegram admin-vezérlő réteg — Iteráció 2 (kész, aktiválásra vár)

Dinamikus, store-vezérelt admin-CMS a bot fölött. **Egyetlen igazságforrás**: a `beallitasok` Blobs-store (verziózott JSON, atomi írás).

### Config-store és dinamikus generátor
- `src/utils/ajanlat/config-store.ts` — verziózott Blobs (`beallitasok` store): `olvasKonfig` (seed, ha üres), `irKonfig` (atomi `onlyIfMatch` + history), `verzioLista`, `visszaallit`.
- `src/utils/ajanlat/admin-config.ts` — `ArazasKonfig`/`SzovegKonfig`/`KapcsoloKonfig` + SEED-ek (a jelenlegi hardcode-olt értékek) + loader/saver (`betoltArak/Szovegek/Kapcsolok`, `mentsd*`).
- **A generátor kizárólag a store-ból olvas**: `pricing.ts` `calculateQuote(input, szorzok, kupon, arak)`, `beepitett-pdf.ts` a `SzovegKonfig`-ból, `adatszerzodes.ts` `buildTemplateData(record, energetikaiDij)`. A `pricing-config.ts`/beépített szövegek már **csak SEED-forrás** — a viselkedés a seed miatt változatlan (bizonyítva: 406 teszt zöld).

### Telegram menürendszer
- `src/utils/ajanlat/telegram-menu.ts` — `/admin` főmenü inline gombokkal, `kezelMenuCallback` dispatch (`menu:/pdf:/debug:/arak:/kupon:/ajanlat:/ugyfel:`), conversation-state (`telegram-store.ts` `allapotMent/Olvas/Torol`) a szerkesztéshez, lapozás, megerősítés destruktív műveletnél.
- **Árak**: fix díjak + hőtermelő felár + energetikai díj + kedvezmény % szerkeszthető (validációval); a sávos díjak nézete kész, szerkesztésük a következő finomítás.
- **PDF-kapcsolók** (`config/kapcsolok`): admin/ügyfél külön + „mindkettő"; az [email.ts](src/utils/ajanlat/email.ts) `sikeresBekuldesLevelei(record, pdf, {pdfAdmin, pdfUgyfel})` szerint csatol; kikapcsolva a levél PDF nélkül, teljes tartalommal.
- **Debug-kapcsoló**: perzisztens, láthatóan jelzett.

### Kuponok, életciklus, ügyfelek, karbantartás
- `kupon-store.ts` — dinamikus kupon-store (`config/kuponok`), a hardcode üres `KUPONOK` helyett; `kuponKeres` az [ajanlat.ts](src/pages/api/ajanlat.ts)/[kupon.ts](src/pages/api/kupon.ts)-ben a store-ból. Menü: lista (státusszal), létrehozás (`ELŐTAG SZÁZALÉK`), aktiválás/deaktiválás.
- **Életciklus** ([store.ts](src/utils/ajanlat/store.ts)): `QuoteStatus` bővítve (`megtekintve/elfogadva/elutasitva/lejart/lezarva`); `listaKerelmek`, `getRequest`, `auditNaplo/auditHozzaad`. Menü: lista (lapozva) → részletek (`ujAjanlatUzenet`) → státuszváltás (lezáráshoz megerősítés) → napló. **Megtekintve**: az [ajanlat-pdf.ts](src/pages/api/ajanlat-pdf.ts) a PDF megnyitásakor `megtekintve` + admin-értesítés (`ertesitsMegtekintes`).
- **Ügyfelek**: `emailNormalized` szerinti aggregáció (kérések száma, utolsó dátum), belépés az ügyfél ajánlataiba.
- **Karbantartás** (`karbantartas.ts` + `netlify/functions/napi-karbantartas.mts` `@daily` + gated `GET /api/karbantartas?debug`): 90 napnál régebbi `sent/megtekintve` → `lejart` + audit; 3 napon belül lejáró aktív kuponok → Telegram-értesítés.

### Aktiválás/teszt
- A `/admin` a bot 4 `TELEGRAM_*` env-jével él (már beállítva). Első `/admin` betölti a store-t a seed-értékekkel.
- Az ütemezett karbantartás a Netlify Scheduled Functions révén fut (a `napi-karbantartas.mts`); manuális teszt: `GET /api/karbantartas?debug`.

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
