import { sendMessage, type InlineButton } from './telegram';
import { betoltArak, betoltKapcsolok, mentsdArak, mentsdKapcsolok, type ArazasKonfig, type KapcsoloKonfig } from './admin-config';
import type { Szolgaltatas } from './pricing-config';
import { allapotMent, allapotOlvas, allapotTorol } from './telegram-store';
import { betoltKuponok, mentsdKuponok } from './kupon-store';
import { kuponHiba, kuponNormalizal, kuponTeljesKod, type Coupon } from './coupons';
import { ujAjanlatUzenet } from './telegram-uzenet';
import { csakSzamjegy, forint } from './format';
import { auditHozzaad, auditNaplo, dateKey, getRequest, listaKerelmek, patchRequest, type QuoteRecord, type QuoteStatus } from './store';
import { ezresPont } from './pdf/format';

const OLDAL_MERET = 6;

const STATUSZ_CIMKE: Record<string, string> = {
    new: '📝 piszkozat',
    sent: '📤 kiküldve',
    failed: '⚠️ hibás',
    blocked: '⛔ blokkolt',
    megtekintve: '👁️ megtekintve',
    elfogadva: '✅ elfogadva',
    elutasitva: '❌ elutasítva',
    lejart: '⏰ lejárt',
    lezarva: '🔒 lezárva'
};

function statuszNev(status: string): string {
    return STATUSZ_CIMKE[status] ?? status;
}

function osszegLeiras(r: QuoteRecord): string {
    return r.vanEgyediArazas || r.vegosszeg === null ? 'egyedi' : forint(r.vegosszeg);
}

const SZERK_MEZOK: Record<string, string> = {
    muszaki_leiras: 'Műszaki leírás díja',
    klimaterv: 'Klímaterv díja',
    felar: 'Hőtermelő felár',
    energetika: 'Energetikai tanúsítvány díja',
    kedvezmeny: 'Mennyezet-kedvezmény (%)'
};

const FOMENU: InlineButton[][] = [
    [
        { text: '💬 Árajánlatok', callback_data: 'menu:ajanlatok' },
        { text: '👥 Ügyfelek', callback_data: 'menu:ugyfelek' }
    ],
    [
        { text: '💰 Árak és szövegek', callback_data: 'menu:arak' },
        { text: '🏷️ Kuponok', callback_data: 'menu:kuponok' }
    ],
    [
        { text: '📄 PDF-generálás', callback_data: 'menu:pdf' },
        { text: '🐞 Debug mód', callback_data: 'menu:debug' }
    ]
];

function vissza(): InlineButton[] {
    return [{ text: '⬅️ Főmenü', callback_data: 'menu:fo' }];
}

function allapot(be: boolean): string {
    return be ? '🟢 BE' : '🔴 KI';
}

export async function fomenu(chatId: number): Promise<void> {
    await sendMessage(chatId, '🏢 <b>Nyári Terv — Adminvezérlő</b>\nVálassz egy menüpontot:', { keyboard: FOMENU });
}

function arLeiras(sz: Szolgaltatas): string {
    const a = sz.arazas;
    if (a.tipus === 'fix') return `${ezresPont(a.ar)},- Ft`;
    if (a.tipus === 'egysegar') return `${ezresPont(a.egysegar)},- Ft/m² (min. ${ezresPont(a.minimumDij)},- Ft)`;
    return a.savok.map((s) => `≤${s.max} m²: ${ezresPont(s.ar)},- Ft`).join(' · ');
}

async function pdfMenu(chatId: number): Promise<void> {
    const k = await betoltKapcsolok();
    const szoveg = ['📄 <b>PDF-generálás</b>', `Admin példány: ${allapot(k.pdfAdmin)}`, `Ügyfél csatolmány: ${allapot(k.pdfUgyfel)}`, '', 'Kikapcsolva a levél PDF nélkül, de teljes tartalommal megy.'].join('\n');
    const keyboard: InlineButton[][] = [
        [{ text: `Admin: ${k.pdfAdmin ? 'kikapcsol' : 'bekapcsol'}`, callback_data: 'pdf:admin' }],
        [{ text: `Ügyfél: ${k.pdfUgyfel ? 'kikapcsol' : 'bekapcsol'}`, callback_data: 'pdf:ugyfel' }],
        [
            { text: '✅ Mindkettő BE', callback_data: 'pdf:mindket:be' },
            { text: '🚫 Mindkettő KI', callback_data: 'pdf:mindket:ki' }
        ],
        vissza()
    ];
    await sendMessage(chatId, szoveg, { keyboard });
}

async function debugMenu(chatId: number): Promise<void> {
    const k = await betoltKapcsolok();
    const szoveg = k.debug ? '🐞 <b>Debug mód</b>: 🟢 BE\n\n⚠️ Figyelem: a debug mód BE van kapcsolva — élesben ne maradjon így!' : '🐞 <b>Debug mód</b>: 🔴 KI';
    const keyboard: InlineButton[][] = [[{ text: k.debug ? 'Kikapcsolom' : 'Bekapcsolom', callback_data: 'debug:toggle' }], vissza()];
    await sendMessage(chatId, szoveg, { keyboard });
}

async function arakMenu(chatId: number): Promise<void> {
    const a = await betoltArak();
    const sorok = a.szolgaltatasok.map((sz) => `• <b>${sz.megnevezes}</b>\n   ${arLeiras(sz)}`);
    const szoveg = ['💰 <b>Aktuális árak</b> (v' + a.arlistaVerzio + ')', '', ...sorok, '', `Hőtermelő felár: ${ezresPont(a.hotermeloFelar)},- Ft`, `Energetikai díj: ${ezresPont(a.energetikaiDij)},- Ft`, `Mennyezet-kedvezmény: ${a.kedvezmenySzazalek}%`, '', 'Szerkeszthető mezők (a sávos díjak szerkesztése a következő lépésben):'].join('\n');
    const keyboard: InlineButton[][] = [
        [
            { text: '✏️ Műszaki leírás', callback_data: 'arak:edit:muszaki_leiras' },
            { text: '✏️ Klímaterv', callback_data: 'arak:edit:klimaterv' }
        ],
        [
            { text: '✏️ Hőtermelő felár', callback_data: 'arak:edit:felar' },
            { text: '✏️ Energetikai díj', callback_data: 'arak:edit:energetika' }
        ],
        [{ text: '✏️ Kedvezmény %', callback_data: 'arak:edit:kedvezmeny' }],
        vissza()
    ];
    await sendMessage(chatId, szoveg, { keyboard });
}

async function arSzerkesztesInditasa(chatId: number, mezo: string): Promise<void> {
    if (!SZERK_MEZOK[mezo]) return;
    await allapotMent(chatId, 'ar', { mezo });
    const kerdes = mezo === 'kedvezmeny' ? 'Írd be az új kedvezmény százalékot (0–100):' : 'Írd be az új díjat forintban (csak szám):';
    await sendMessage(chatId, `✏️ <b>${SZERK_MEZOK[mezo]}</b>\n${kerdes}\n\n(Megszakítás: /admin)`);
}

function alkalmazArMezo(a: ArazasKonfig, mezo: string, ertek: number): ArazasKonfig {
    const uj: ArazasKonfig = JSON.parse(JSON.stringify(a));
    if (mezo === 'felar') uj.hotermeloFelar = ertek;
    else if (mezo === 'energetika') uj.energetikaiDij = ertek;
    else if (mezo === 'kedvezmeny') uj.kedvezmenySzazalek = ertek;
    else {
        const sz = uj.szolgaltatasok.find((s) => s.kod === mezo);
        if (sz && sz.arazas.tipus === 'fix') sz.arazas.ar = ertek;
    }
    return uj;
}

async function arBemenet(chatId: number, mezo: string, szoveg: string): Promise<boolean> {
    const nyers = csakSzamjegy(szoveg);
    if (nyers === '') {
        await sendMessage(chatId, '⚠️ Érvénytelen érték — csak számot adj meg. Próbáld újra, vagy /admin a megszakításhoz.');
        return true;
    }
    const ertek = Number.parseInt(nyers, 10);
    if (mezo === 'kedvezmeny' && ertek > 100) {
        await sendMessage(chatId, '⚠️ A kedvezmény 0 és 100 között lehet. Próbáld újra.');
        return true;
    }
    const a = await betoltArak();
    const uj = alkalmazArMezo(a, mezo, ertek);
    await mentsdArak(uj, String(chatId), `${SZERK_MEZOK[mezo] ?? mezo} módosítás → ${ertek}`);
    await allapotTorol(chatId);
    const megjelenit = mezo === 'kedvezmeny' ? `${ertek}%` : `${ezresPont(ertek)},- Ft`;
    await sendMessage(chatId, `✅ Mentve: <b>${SZERK_MEZOK[mezo] ?? mezo}</b> = ${megjelenit}`);
    await arakMenu(chatId);
    return true;
}

function kuponAllapotCimke(k: Coupon, ma: string): string {
    if (!k.aktiv) return '⚪ inaktív';
    if (k.ervenyesIg && ma > k.ervenyesIg) return '🔴 lejárt';
    if (k.ervenyesTol && ma < k.ervenyesTol) return '🟡 még nem aktív';
    return '🟢 aktív';
}

async function kuponokMenu(chatId: number): Promise<void> {
    const kuponok = await betoltKuponok();
    const ma = dateKey();
    const sorok = kuponok.length === 0 ? ['(még nincs kupon)'] : kuponok.map((k) => `• <code>${kuponNormalizal(kuponTeljesKod(k))}</code> — ${k.szazalek}% · ${kuponAllapotCimke(k, ma)}`);
    const gombok: InlineButton[][] = kuponok.map((k) => {
        const kod = kuponNormalizal(kuponTeljesKod(k));
        return [{ text: `${k.aktiv ? '⚪ Deaktivál' : '🟢 Aktivál'}: ${kod}`, callback_data: `kupon:toggle:${kod}` }];
    });
    gombok.push([{ text: '➕ Új kupon', callback_data: 'kupon:uj' }]);
    gombok.push(vissza());
    await sendMessage(chatId, ['🏷️ <b>Kuponok</b>', '', ...sorok].join('\n'), { keyboard: gombok });
}

async function kuponUjInditasa(chatId: number): Promise<void> {
    await allapotMent(chatId, 'kupon-uj', {});
    await sendMessage(chatId, '➕ <b>Új kupon</b>\nÍrd be: <b>ELŐTAG SZÁZALÉK</b>\nPélda: <code>NYAR 10</code> → a <code>NYAR10</code> kód, 10% kedvezménnyel.\n\n(Megszakítás: /admin)');
}

async function kuponToggle(chatId: number, kod: string): Promise<void> {
    const kuponok = await betoltKuponok();
    const k = kuponok.find((x) => kuponNormalizal(kuponTeljesKod(x)) === kod);
    if (k) {
        k.aktiv = !k.aktiv;
        await mentsdKuponok(kuponok, String(chatId), `${kod} ${k.aktiv ? 'aktiválás' : 'deaktiválás'}`);
    }
    await kuponokMenu(chatId);
}

async function kuponUjBemenet(chatId: number, szoveg: string): Promise<boolean> {
    const reszek = szoveg.trim().split(/\s+/);
    const elotag = (reszek[0] ?? '').toUpperCase();
    const szazalekNyers = csakSzamjegy(reszek[1] ?? '');
    const szazalek = szazalekNyers === '' ? -1 : Number.parseInt(szazalekNyers, 10);
    const uj: Coupon = { elotag, szazalek, aktiv: true };
    const hiba = kuponHiba(uj);
    if (hiba) {
        await sendMessage(chatId, `⚠️ ${hiba}\nPróbáld újra (pl. <code>NYAR 10</code>), vagy /admin a megszakításhoz.`);
        return true;
    }
    const kuponok = await betoltKuponok();
    const kod = kuponNormalizal(kuponTeljesKod(uj));
    if (kuponok.some((k) => kuponNormalizal(kuponTeljesKod(k)) === kod)) {
        await sendMessage(chatId, `⚠️ Már létezik <code>${kod}</code> kupon. Adj meg másikat, vagy /admin.`);
        return true;
    }
    kuponok.push(uj);
    await mentsdKuponok(kuponok, String(chatId), `Új kupon: ${kod}`);
    await allapotTorol(chatId);
    await sendMessage(chatId, `✅ Létrehozva: <code>${kod}</code> (${uj.szazalek}%, aktív)`);
    await kuponokMenu(chatId);
    return true;
}

export async function kezelAllapotBemenet(chatId: number, szoveg: string): Promise<boolean> {
    const allapot = await allapotOlvas(chatId);
    if (!allapot) return false;
    if (allapot.fajta === 'ar') return arBemenet(chatId, allapot.adat.mezo, szoveg);
    if (allapot.fajta === 'kupon-uj') return kuponUjBemenet(chatId, szoveg);
    return false;
}

export function idopontRovid(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const reszek = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
    const ertek = (tipus: string): string => reszek.find((r) => r.type === tipus)?.value ?? '';
    return `${ertek('year')}.${ertek('month')}.${ertek('day')}. ${ertek('hour')}:${ertek('minute')}`;
}

async function ajanlatokMenu(chatId: number, oldal: number): Promise<void> {
    const mind = await listaKerelmek(60);
    if (mind.length === 0) {
        await sendMessage(chatId, '💬 <b>Árajánlatok</b>\n\n(még nincs beküldött ajánlat)', { keyboard: [vissza()] });
        return;
    }
    const lapok = Math.ceil(mind.length / OLDAL_MERET);
    const p = Math.max(0, Math.min(oldal, lapok - 1));
    const szelet = mind.slice(p * OLDAL_MERET, p * OLDAL_MERET + OLDAL_MERET);
    const gombok: InlineButton[][] = szelet.map((r) => [{ text: `${statuszNev(r.status)} · ${r.nev} · ${osszegLeiras(r)}`, callback_data: `ajanlat:reszlet:${r.id}` }]);
    const lapozo: InlineButton[] = [];
    if (p > 0) lapozo.push({ text: '⬅️ Előző', callback_data: `ajanlat:lista:${p - 1}` });
    if (p < lapok - 1) lapozo.push({ text: 'Következő ➡️', callback_data: `ajanlat:lista:${p + 1}` });
    if (lapozo.length > 0) gombok.push(lapozo);
    gombok.push(vissza());
    await sendMessage(chatId, `💬 <b>Árajánlatok</b> — ${mind.length} db · ${p + 1}/${lapok}. oldal`, { keyboard: gombok });
}

async function ajanlatReszletek(chatId: number, id: string): Promise<void> {
    const r = await getRequest(id);
    if (!r) {
        await sendMessage(chatId, '⚠️ Az ajánlat nem található.', { keyboard: [[{ text: '⬅️ Lista', callback_data: 'ajanlat:lista:0' }]] });
        return;
    }
    const { szoveg } = ujAjanlatUzenet(r);
    const gombok: InlineButton[][] = [
        [
            { text: '✅ Elfogadva', callback_data: `ajanlat:status:${id}:elfogadva` },
            { text: '❌ Elutasítva', callback_data: `ajanlat:status:${id}:elutasitva` }
        ],
        [
            { text: '⏰ Lejárt', callback_data: `ajanlat:status:${id}:lejart` },
            { text: '🔒 Lezárás', callback_data: `ajanlat:confirm:${id}` }
        ],
        [{ text: '🧾 Napló', callback_data: `ajanlat:audit:${id}` }],
        [
            { text: '⬅️ Lista', callback_data: 'ajanlat:lista:0' },
            { text: '🏠 Főmenü', callback_data: 'menu:fo' }
        ]
    ];
    await sendMessage(chatId, `Állapot: <b>${statuszNev(r.status)}</b>\n\n${szoveg}`, { keyboard: gombok });
}

async function statuszValt(chatId: number, id: string, uj: QuoteStatus): Promise<void> {
    await patchRequest(id, { status: uj });
    await auditHozzaad(id, String(chatId), `státusz → ${statuszNev(uj)}`);
    await sendMessage(chatId, `✅ Új állapot: <b>${statuszNev(uj)}</b>`);
    await ajanlatReszletek(chatId, id);
}

async function lezarasMegerosites(chatId: number, id: string): Promise<void> {
    await sendMessage(chatId, '🔒 Biztosan <b>lezárod</b> ezt az ajánlatot?', {
        keyboard: [
            [
                { text: '✅ Igen, lezárom', callback_data: `ajanlat:status:${id}:lezarva` },
                { text: '↩️ Mégse', callback_data: `ajanlat:reszlet:${id}` }
            ]
        ]
    });
}

async function ajanlatAudit(chatId: number, id: string): Promise<void> {
    const naplo = await auditNaplo(id);
    const sorok = naplo.length === 0 ? ['(nincs napló-bejegyzés)'] : naplo.map((b) => `• ${idopontRovid(b.mikor)} — ${b.mit}`);
    await sendMessage(chatId, `🧾 <b>Napló</b>\n\n${sorok.join('\n')}`, { keyboard: [[{ text: '⬅️ Vissza az ajánlathoz', callback_data: `ajanlat:reszlet:${id}` }]] });
}

const STATUSZ_VALTHATO: QuoteStatus[] = ['elfogadva', 'elutasitva', 'lejart', 'lezarva'];

export function napFormat(nap: string): string {
    return `${nap.replace(/-/g, '.')}.`;
}

async function datumokMenu(chatId: number, oldal: number): Promise<void> {
    const mind = await listaKerelmek(200);
    if (mind.length === 0) {
        await sendMessage(chatId, '👥 <b>Ügyfelek</b>\n\n(még nincs beküldés)', { keyboard: [vissza()] });
        return;
    }
    const szamlalo = new Map<string, number>();
    for (const r of mind) {
        const nap = dateKey(new Date(r.createdAt));
        szamlalo.set(nap, (szamlalo.get(nap) ?? 0) + 1);
    }
    const napok = [...szamlalo.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    const lapok = Math.ceil(napok.length / OLDAL_MERET);
    const p = Math.max(0, Math.min(oldal, lapok - 1));
    const szelet = napok.slice(p * OLDAL_MERET, p * OLDAL_MERET + OLDAL_MERET);
    const gombok: InlineButton[][] = szelet.map(([nap, db]) => [{ text: `📅 ${napFormat(nap)} — ${db} db`, callback_data: `datum:${nap}` }]);
    const lapozo: InlineButton[] = [];
    if (p > 0) lapozo.push({ text: '⬅️ Előző', callback_data: `datumlista:${p - 1}` });
    if (p < lapok - 1) lapozo.push({ text: 'Következő ➡️', callback_data: `datumlista:${p + 1}` });
    if (lapozo.length > 0) gombok.push(lapozo);
    gombok.push(vissza());
    await sendMessage(chatId, `👥 <b>Ügyfelek — dátumok</b>\n${napok.length} nap · ${mind.length} ajánlat · ${p + 1}/${lapok}. oldal`, { keyboard: gombok });
}

async function datumReszletek(chatId: number, nap: string): Promise<void> {
    const mind = await listaKerelmek(200);
    const aznapi = mind.filter((r) => dateKey(new Date(r.createdAt)) === nap);
    if (aznapi.length === 0) {
        await sendMessage(chatId, '⚠️ Ehhez a naphoz nincs beküldés.', { keyboard: [[{ text: '⬅️ Dátumok', callback_data: 'datumlista:0' }]] });
        return;
    }
    const gombok: InlineButton[][] = aznapi.map((r) => [{ text: `${r.nev} · ${idopontRovid(r.createdAt)} · ${statuszNev(r.status)} · ${osszegLeiras(r)}`, callback_data: `ajanlat:reszlet:${r.id}` }]);
    gombok.push([{ text: '⬅️ Dátumok', callback_data: 'datumlista:0' }, { text: '🏠 Főmenü', callback_data: 'menu:fo' }]);
    await sendMessage(chatId, `📅 <b>${napFormat(nap)}</b> — ${aznapi.length} ajánlat`, { keyboard: gombok });
}

export async function kezelMenuCallback(chatId: number, data: string): Promise<boolean> {
    if (data === 'menu:fo') {
        await fomenu(chatId);
        return true;
    }
    if (data === 'menu:pdf') {
        await pdfMenu(chatId);
        return true;
    }
    if (data === 'menu:debug') {
        await debugMenu(chatId);
        return true;
    }
    if (data === 'menu:arak') {
        await arakMenu(chatId);
        return true;
    }
    if (data.startsWith('arak:edit:')) {
        await arSzerkesztesInditasa(chatId, data.slice('arak:edit:'.length));
        return true;
    }
    if (data === 'menu:ajanlatok') {
        await ajanlatokMenu(chatId, 0);
        return true;
    }
    if (data.startsWith('ajanlat:lista:')) {
        await ajanlatokMenu(chatId, Number.parseInt(data.slice('ajanlat:lista:'.length), 10) || 0);
        return true;
    }
    if (data.startsWith('ajanlat:reszlet:')) {
        await ajanlatReszletek(chatId, data.slice('ajanlat:reszlet:'.length));
        return true;
    }
    if (data.startsWith('ajanlat:audit:')) {
        await ajanlatAudit(chatId, data.slice('ajanlat:audit:'.length));
        return true;
    }
    if (data.startsWith('ajanlat:confirm:')) {
        await lezarasMegerosites(chatId, data.slice('ajanlat:confirm:'.length));
        return true;
    }
    if (data.startsWith('ajanlat:status:')) {
        const reszek = data.split(':');
        const id = reszek[2];
        const uj = reszek[3] as QuoteStatus;
        if (id && STATUSZ_VALTHATO.includes(uj)) await statuszValt(chatId, id, uj);
        return true;
    }
    if (data === 'menu:ugyfelek') {
        await datumokMenu(chatId, 0);
        return true;
    }
    if (data.startsWith('datumlista:')) {
        await datumokMenu(chatId, Number.parseInt(data.slice('datumlista:'.length), 10) || 0);
        return true;
    }
    if (data.startsWith('datum:')) {
        await datumReszletek(chatId, data.slice('datum:'.length));
        return true;
    }
    if (data === 'menu:kuponok') {
        await kuponokMenu(chatId);
        return true;
    }
    if (data === 'kupon:uj') {
        await kuponUjInditasa(chatId);
        return true;
    }
    if (data.startsWith('kupon:toggle:')) {
        await kuponToggle(chatId, data.slice('kupon:toggle:'.length));
        return true;
    }

    if (data === 'pdf:admin' || data === 'pdf:ugyfel' || data.startsWith('pdf:mindket:')) {
        const k = await betoltKapcsolok();
        const uj: KapcsoloKonfig = { ...k };
        if (data === 'pdf:admin') uj.pdfAdmin = !k.pdfAdmin;
        else if (data === 'pdf:ugyfel') uj.pdfUgyfel = !k.pdfUgyfel;
        else {
            const be = data.endsWith(':be');
            uj.pdfAdmin = be;
            uj.pdfUgyfel = be;
        }
        await mentsdKapcsolok(uj, String(chatId), 'PDF-kapcsoló módosítás');
        await pdfMenu(chatId);
        return true;
    }
    if (data === 'debug:toggle') {
        const k = await betoltKapcsolok();
        await mentsdKapcsolok({ ...k, debug: !k.debug }, String(chatId), 'Debug-kapcsoló módosítás');
        await debugMenu(chatId);
        return true;
    }

    return false;
}
