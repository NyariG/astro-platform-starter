import { sendMessage, type InlineButton } from './telegram';
import { betoltArak, betoltKapcsolok, betoltSzovegek, mentsdArak, mentsdKapcsolok, mentsdSzovegek, type ArazasKonfig, type KapcsoloKonfig, type SzovegKonfig } from './admin-config';
import { savKonfigHibak, type Szolgaltatas } from './pricing-config';
import { allapotMent, allapotOlvas, allapotTorol, createLinkToken, listAdmins, unlinkAdmin, type TelegramAdmin } from './telegram-store';
import { betoltKuponok, mentsdKuponok } from './kupon-store';
import { kuponHiba, kuponNormalizal, kuponTeljesKod, type Coupon } from './coupons';
import { ujAjanlatUzenet } from './telegram-uzenet';
import { csakSzamjegy, forint } from './format';
import { auditHozzaad, auditNaplo, dateKey, getRequest, listaKerelmek, patchRequest, readEnv, type QuoteRecord, type QuoteStatus } from './store';
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

type ArCel = 'fix' | 'sav' | 'egyseg' | 'min' | 'felar' | 'energetika' | 'kedvezmeny';

const ARCEL_CIMKE: Record<string, string> = {
    fix: 'Díj',
    sav: 'Sáv díja',
    egyseg: 'Egységár (Ft/m²)',
    min: 'Minimumdíj',
    felar: 'Hőtermelő felár',
    energetika: 'Energetikai tanúsítvány díja',
    kedvezmeny: 'Mennyezet-kedvezmény (%)'
};

type SzovegMezo = {
    kulcs: string;
    cimke: string;
    lista: boolean;
    get: (sz: SzovegKonfig) => string | string[];
    set: (sz: SzovegKonfig, ertek: string | string[]) => void;
};

const SZOVEG_MEZOK: SzovegMezo[] = [
    { kulcs: 'muszakiNev', cimke: 'Műszaki leírás neve', lista: false, get: (s) => s.muszakiNev, set: (s, v) => { s.muszakiNev = v as string; } },
    { kulcs: 'reszletezo', cimke: 'Műszaki leírás részletező', lista: false, get: (s) => s.reszletezo, set: (s, v) => { s.reszletezo = v as string; } },
    { kulcs: 'kertFejlec', cimke: 'Kertépítés fejléc', lista: false, get: (s) => s.kertFejlec, set: (s, v) => { s.kertFejlec = v as string; } },
    { kulcs: 'energetikaiNev', cimke: 'Energetikai tétel neve', lista: false, get: (s) => s.pdf.energetikaiNev, set: (s, v) => { s.pdf.energetikaiNev = v as string; } },
    { kulcs: 'energetikaiSzoveg', cimke: 'Energetikai megjegyzés', lista: false, get: (s) => s.pdf.energetikaiSzoveg, set: (s, v) => { s.pdf.energetikaiSzoveg = v as string; } },
    { kulcs: 'tartalmazza', cimke: 'Tartalmazza (lista)', lista: true, get: (s) => s.pdf.tartalmazza, set: (s, v) => { s.pdf.tartalmazza = v as string[]; } },
    { kulcs: 'nemTartalmazza', cimke: 'Nem tartalmazza (lista)', lista: true, get: (s) => s.pdf.nemTartalmazza, set: (s, v) => { s.pdf.nemTartalmazza = v as string[]; } },
    { kulcs: 'hataridok', cimke: 'Határidők (lista)', lista: true, get: (s) => s.pdf.hataridok, set: (s, v) => { s.pdf.hataridok = v as string[]; } },
    { kulcs: 'ervenyesseg', cimke: 'Érvényesség', lista: false, get: (s) => s.pdf.ervenyesseg, set: (s, v) => { s.pdf.ervenyesseg = v as string; } },
    { kulcs: 'adomentes', cimke: 'Adómentesség', lista: false, get: (s) => s.pdf.adomentes, set: (s, v) => { s.pdf.adomentes = v as string; } }
];

function szovegMezo(kulcs: string): SzovegMezo | undefined {
    return SZOVEG_MEZOK.find((m) => m.kulcs === kulcs);
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rovidit(s: string, max = 24): string {
    return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function listaBont(szoveg: string): string[] {
    return szoveg
        .split('\n')
        .map((s) => s.trim().replace(/^[•\-*]\s+/, '').trim())
        .filter((s) => s !== '');
}

export function alkalmazArCel(a: ArazasKonfig, cel: ArCel, kod: string, index: number, ertek: number): ArazasKonfig {
    const uj: ArazasKonfig = JSON.parse(JSON.stringify(a));
    if (cel === 'felar') uj.hotermeloFelar = ertek;
    else if (cel === 'energetika') uj.energetikaiDij = ertek;
    else if (cel === 'kedvezmeny') uj.kedvezmenySzazalek = ertek;
    else {
        const sz = uj.szolgaltatasok.find((s) => s.kod === kod);
        if (!sz) return uj;
        const ar = sz.arazas;
        if (cel === 'fix' && ar.tipus === 'fix') ar.ar = ertek;
        else if (cel === 'sav' && ar.tipus === 'sav') {
            const sav = ar.savok[index];
            if (sav) sav.ar = ertek;
        } else if (cel === 'egyseg' && ar.tipus === 'egysegar') ar.egysegar = ertek;
        else if (cel === 'min' && ar.tipus === 'egysegar') ar.minimumDij = ertek;
    }
    return uj;
}

export function alkalmazTetelNev(a: ArazasKonfig, kod: string, nev: string): ArazasKonfig {
    const uj: ArazasKonfig = JSON.parse(JSON.stringify(a));
    const sz = uj.szolgaltatasok.find((s) => s.kod === kod);
    if (sz) sz.megnevezes = nev;
    return uj;
}

export function alkalmazSzovegMezo(sz: SzovegKonfig, kulcs: string, ertek: string | string[]): SzovegKonfig {
    const uj: SzovegKonfig = JSON.parse(JSON.stringify(sz));
    const mezo = szovegMezo(kulcs);
    if (mezo) mezo.set(uj, ertek);
    return uj;
}

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
    ],
    [
        { text: '📧 Napi e-mail limit', callback_data: 'menu:limit' },
        { text: '👤 Adminok', callback_data: 'menu:adminok' }
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

async function limitMenu(chatId: number): Promise<void> {
    const k = await betoltKapcsolok();
    const szoveg = k.napiLimit
        ? '📧 <b>Napi e-mail limit</b>: 🟢 BE\n\nCímenként naponta 1 árajánlat-levél mehet ki. A korlát fölötti ismételt kérésnél az ügyfél NEM kap levelet, de figyelmeztetést sem lát — csak simán nem küldjük ki. (Az IP-alapú fék is aktív.)'
        : '📧 <b>Napi e-mail limit</b>: 🔴 KI (korlátlan)\n\nMinden ajánlatkérésre kimegy a levél, IP-korlát nélkül.';
    const keyboard: InlineButton[][] = [[{ text: k.napiLimit ? '🔓 Korlátlanra (KI)' : '🔒 Napi 1-re (BE)', callback_data: 'limit:toggle' }], vissza()];
    await sendMessage(chatId, szoveg, { keyboard });
}

function ujLinkToken(): string {
    const bajtok = new Uint8Array(24);
    crypto.getRandomValues(bajtok);
    return Array.from(bajtok, (b) => b.toString(16).padStart(2, '0')).join('');
}

function adminNev(a: TelegramAdmin): string {
    return a.username ? `@${a.username}` : `azonosító: ${a.chatId}`;
}

export async function adminokMenu(chatId: number): Promise<void> {
    const adminok = await listAdmins();
    const sorok = adminok.map((a) => `• ${escHtml(adminNev(a))}${a.chatId === chatId ? ' <i>(te)</i>' : ''} — összekötve: ${idopontRovid(a.linkedAt)}`);
    const gombok: InlineButton[][] = adminok.map((a) => [{ text: `🗑 Eltávolít: ${a.username ? '@' + a.username : a.chatId}`, callback_data: `admin:torol:${a.chatId}` }]);
    gombok.push([{ text: '➕ Új admin', callback_data: 'admin:uj' }]);
    gombok.push(vissza());
    await sendMessage(chatId, ['👤 <b>Adminok</b> — ' + adminok.length + ' fő', '', ...sorok].join('\n'), { keyboard: gombok });
}

async function adminUjLink(chatId: number): Promise<void> {
    const token = ujLinkToken();
    await createLinkToken(token);
    const botNev = readEnv('TELEGRAM_BOT_USERNAME');
    const link = botNev ? `https://t.me/${botNev}?start=${token}` : null;
    const szoveg = link
        ? `➕ <b>Új admin meghívása</b>\n\nKüldd el ezt a linket az új adminnak — 10 percig él, egyszer használatos:\n\n${link}\n\nMiután megnyitja és a botban a Start gombra koppint, adminná válik.`
        : `➕ <b>Új admin meghívása</b>\n\nA bot felhasználóneve nincs beállítva, ezért az új admin ezt írja be a botnak (10 percig él, egyszer használatos):\n\n<code>/start ${token}</code>`;
    await sendMessage(chatId, szoveg, { keyboard: [[{ text: '⬅️ Adminok', callback_data: 'menu:adminok' }]] });
}

async function adminTorolMegerosites(chatId: number, celChatId: number): Promise<void> {
    const adminok = await listAdmins();
    if (adminok.length <= 1) {
        await sendMessage(chatId, '⚠️ Az utolsó admin nem távolítható el — különben senki sem tudná vezérelni a botot. Előbb köss össze egy másik admint.', { keyboard: [[{ text: '⬅️ Adminok', callback_data: 'menu:adminok' }]] });
        return;
    }
    const cel = adminok.find((a) => a.chatId === celChatId);
    const nev = cel ? escHtml(adminNev(cel)) : String(celChatId);
    await sendMessage(chatId, `🗑 Biztosan eltávolítod${celChatId === chatId ? ' saját magadat' : ''} ezt az admint: <b>${nev}</b>?`, {
        keyboard: [
            [
                { text: '✅ Igen, eltávolítom', callback_data: `admin:torolMegerosit:${celChatId}` },
                { text: '↩️ Mégse', callback_data: 'menu:adminok' }
            ]
        ]
    });
}

async function adminTorol(chatId: number, celChatId: number): Promise<void> {
    const adminok = await listAdmins();
    if (adminok.length <= 1) {
        await sendMessage(chatId, '⚠️ Az utolsó admin nem távolítható el.', { keyboard: [[{ text: '⬅️ Adminok', callback_data: 'menu:adminok' }]] });
        return;
    }
    await unlinkAdmin(celChatId);
    await sendMessage(chatId, '✅ Az admin eltávolítva.');
    await adminokMenu(chatId);
}

async function arakSzovegekMenu(chatId: number): Promise<void> {
    await sendMessage(chatId, '💰 <b>Árak és szövegek</b>\nMit szeretnél szerkeszteni?', {
        keyboard: [[{ text: '💰 Árak', callback_data: 'arak:lista' }], [{ text: '📝 Szövegek', callback_data: 'szoveg:menu' }], vissza()]
    });
}

async function arakMenu(chatId: number): Promise<void> {
    const a = await betoltArak();
    const sorok = a.szolgaltatasok.map((sz) => `• <b>${escHtml(sz.megnevezes)}</b>\n   ${arLeiras(sz)}`);
    const szoveg = ['💰 <b>Aktuális árak</b> (v' + a.arlistaVerzio + ')', '', ...sorok, '', `Hőtermelő felár: ${ezresPont(a.hotermeloFelar)},- Ft`, `Energetikai díj: ${ezresPont(a.energetikaiDij)},- Ft`, `Mennyezet-kedvezmény: ${a.kedvezmenySzazalek}%`, '', 'Válaszd ki, melyik tétel árát szerkeszted:'].join('\n');
    const svcGombok: InlineButton[][] = [];
    for (let i = 0; i < a.szolgaltatasok.length; i += 2) {
        svcGombok.push(a.szolgaltatasok.slice(i, i + 2).map((sz) => ({ text: `✏️ ${rovidit(sz.megnevezes, 20)}`, callback_data: `arak:svc:${sz.kod}` })));
    }
    const keyboard: InlineButton[][] = [
        ...svcGombok,
        [
            { text: '✏️ Hőtermelő felár', callback_data: 'arak:edit:felar' },
            { text: '✏️ Energetikai díj', callback_data: 'arak:edit:energetika' }
        ],
        [{ text: '✏️ Kedvezmény %', callback_data: 'arak:edit:kedvezmeny' }],
        [{ text: '⬅️ Vissza', callback_data: 'menu:arak' }]
    ];
    await sendMessage(chatId, szoveg, { keyboard });
}

async function arSzolgaltatasMenu(chatId: number, kod: string): Promise<void> {
    const a = await betoltArak();
    const sz = a.szolgaltatasok.find((s) => s.kod === kod);
    if (!sz) {
        await arakMenu(chatId);
        return;
    }
    const ar = sz.arazas;
    const gombok: InlineButton[][] = [];
    if (ar.tipus === 'fix') {
        gombok.push([{ text: `✏️ Díj: ${ezresPont(ar.ar)},- Ft`, callback_data: `arak:edit:fix:${kod}` }]);
    } else if (ar.tipus === 'egysegar') {
        gombok.push([{ text: `✏️ Egységár: ${ezresPont(ar.egysegar)},- Ft/m²`, callback_data: `arak:edit:egyseg:${kod}` }]);
        gombok.push([{ text: `✏️ Minimumdíj: ${ezresPont(ar.minimumDij)},- Ft`, callback_data: `arak:edit:min:${kod}` }]);
    } else {
        ar.savok.forEach((s, i) => {
            gombok.push([{ text: `✏️ ≤${s.max} m²: ${ezresPont(s.ar)},- Ft`, callback_data: `arak:edit:sav:${kod}:${i}` }]);
        });
    }
    gombok.push([{ text: '⬅️ Árak', callback_data: 'arak:lista' }]);
    await sendMessage(chatId, `💰 <b>${escHtml(sz.megnevezes)}</b>\n${arLeiras(sz)}\n\nMelyik értéket módosítod?`, { keyboard: gombok });
}

async function arSzerkesztesInditasa(chatId: number, cel: string, kod: string, index: string): Promise<void> {
    if (!(cel in ARCEL_CIMKE)) return;
    await allapotMent(chatId, 'ar', { cel, kod, index });
    const kerdes = cel === 'kedvezmeny' ? 'Írd be az új százalékot (0–100):' : 'Írd be az új értéket forintban (csak szám):';
    await sendMessage(chatId, `✏️ <b>${ARCEL_CIMKE[cel]}</b>\n${kerdes}\n\n(Megszakítás: /admin)`);
}

async function arBemenet(chatId: number, adat: Record<string, string>, szoveg: string): Promise<boolean> {
    const cel = adat.cel as ArCel;
    const nyers = csakSzamjegy(szoveg);
    if (nyers === '') {
        await sendMessage(chatId, '⚠️ Érvénytelen érték — csak számot adj meg. Próbáld újra, vagy /admin a megszakításhoz.');
        return true;
    }
    const ertek = Number.parseInt(nyers, 10);
    if (cel === 'kedvezmeny' && ertek > 100) {
        await sendMessage(chatId, '⚠️ A kedvezmény 0 és 100 között lehet. Próbáld újra.');
        return true;
    }
    const index = Number.parseInt(adat.index ?? '0', 10) || 0;
    const a = await betoltArak();
    const uj = alkalmazArCel(a, cel, adat.kod ?? '', index, ertek);
    const hibak = savKonfigHibak(uj.szolgaltatasok);
    if (hibak.length > 0) {
        await sendMessage(chatId, `⚠️ A módosítás érvénytelen árlistát adna:\n${hibak.join('\n')}\nPróbáld újra, vagy /admin.`);
        return true;
    }
    await mentsdArak(uj, String(chatId), `${ARCEL_CIMKE[cel] ?? cel}${adat.kod ? ` — ${adat.kod}` : ''} → ${ertek}`);
    await allapotTorol(chatId);
    const megjelenit = cel === 'kedvezmeny' ? `${ertek}%` : `${ezresPont(ertek)},- Ft`;
    await sendMessage(chatId, `✅ Mentve: <b>${ARCEL_CIMKE[cel] ?? cel}</b> = ${megjelenit}`);
    if (adat.kod && (cel === 'fix' || cel === 'sav' || cel === 'egyseg' || cel === 'min')) await arSzolgaltatasMenu(chatId, adat.kod);
    else await arakMenu(chatId);
    return true;
}

async function szovegekMenu(chatId: number): Promise<void> {
    await sendMessage(chatId, '📝 <b>Szövegek</b>\nMit szerkesztesz?', {
        keyboard: [[{ text: '📛 Tételnevek', callback_data: 'szoveg:nevek' }], [{ text: '📄 PDF-szövegek', callback_data: 'szoveg:pdf' }], [{ text: '⬅️ Vissza', callback_data: 'menu:arak' }]]
    });
}

async function tetelNevekMenu(chatId: number): Promise<void> {
    const a = await betoltArak();
    const sorok = a.szolgaltatasok.map((sz) => `• <b>${escHtml(sz.megnevezes)}</b>`);
    const gombok: InlineButton[][] = a.szolgaltatasok.map((sz) => [{ text: `✏️ ${rovidit(sz.megnevezes, 28)}`, callback_data: `szoveg:nev:${sz.kod}` }]);
    gombok.push([{ text: '⬅️ Szövegek', callback_data: 'szoveg:menu' }]);
    await sendMessage(chatId, ['📛 <b>Tételnevek</b>', '', ...sorok, '', 'Válaszd ki, melyik nevet írod át:'].join('\n'), { keyboard: gombok });
}

async function pdfSzovegekMenu(chatId: number): Promise<void> {
    const gombok: InlineButton[][] = SZOVEG_MEZOK.map((m) => [{ text: `✏️ ${m.cimke}`, callback_data: `szoveg:mezo:${m.kulcs}` }]);
    gombok.push([{ text: '⬅️ Szövegek', callback_data: 'szoveg:menu' }]);
    await sendMessage(chatId, '📄 <b>PDF-szövegek</b>\nVálaszd ki a mezőt:', { keyboard: gombok });
}

async function tetelNevInditasa(chatId: number, kod: string): Promise<void> {
    const a = await betoltArak();
    const sz = a.szolgaltatasok.find((s) => s.kod === kod);
    if (!sz) {
        await tetelNevekMenu(chatId);
        return;
    }
    await allapotMent(chatId, 'szoveg', { cel: 'nev', kod });
    await sendMessage(chatId, `✏️ <b>Tételnév</b>\nJelenlegi: ${escHtml(sz.megnevezes)}\n\nÍrd be az új nevet.\n\n(Megszakítás: /admin)`);
}

async function szovegMezoInditasa(chatId: number, kulcs: string): Promise<void> {
    const mezo = szovegMezo(kulcs);
    if (!mezo) return;
    const sz = await betoltSzovegek();
    const jelenlegi = mezo.get(sz);
    const jelenlegiSzoveg = Array.isArray(jelenlegi) ? jelenlegi.map((x) => `• ${x}`).join('\n') : jelenlegi;
    await allapotMent(chatId, 'szoveg', { cel: 'mezo', kulcs });
    const utmutato = mezo.lista ? 'Írd be az új listát — soronként egy elem.' : 'Írd be az új szöveget.';
    await sendMessage(chatId, `✏️ <b>${mezo.cimke}</b>\nJelenlegi:\n${escHtml(jelenlegiSzoveg)}\n\n${utmutato}\n\n(Megszakítás: /admin)`);
}

async function szovegBemenet(chatId: number, adat: Record<string, string>, szoveg: string): Promise<boolean> {
    if (adat.cel === 'nev') {
        const nev = szoveg.trim();
        if (nev === '') {
            await sendMessage(chatId, '⚠️ A név nem lehet üres. Próbáld újra, vagy /admin.');
            return true;
        }
        const a = await betoltArak();
        const uj = alkalmazTetelNev(a, adat.kod ?? '', nev);
        await mentsdArak(uj, String(chatId), `Tételnév (${adat.kod}) → ${nev}`);
        await allapotTorol(chatId);
        await sendMessage(chatId, `✅ Mentve: <b>${escHtml(nev)}</b>`);
        await tetelNevekMenu(chatId);
        return true;
    }
    if (adat.cel === 'mezo') {
        const mezo = szovegMezo(adat.kulcs ?? '');
        if (!mezo) {
            await allapotTorol(chatId);
            return true;
        }
        let ertek: string | string[];
        if (mezo.lista) {
            const lista = listaBont(szoveg);
            if (lista.length === 0) {
                await sendMessage(chatId, '⚠️ Legalább egy elem kell. Próbáld újra, vagy /admin.');
                return true;
            }
            ertek = lista;
        } else {
            const s = szoveg.trim();
            if (s === '') {
                await sendMessage(chatId, '⚠️ A szöveg nem lehet üres. Próbáld újra, vagy /admin.');
                return true;
            }
            ertek = s;
        }
        const sz = await betoltSzovegek();
        const uj = alkalmazSzovegMezo(sz, mezo.kulcs, ertek);
        await mentsdSzovegek(uj, String(chatId), `Szöveg (${mezo.kulcs}) módosítás`);
        await allapotTorol(chatId);
        await sendMessage(chatId, `✅ Mentve: <b>${escHtml(mezo.cimke)}</b>`);
        await pdfSzovegekMenu(chatId);
        return true;
    }
    return false;
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
    if (allapot.fajta === 'ar') return arBemenet(chatId, allapot.adat, szoveg);
    if (allapot.fajta === 'szoveg') return szovegBemenet(chatId, allapot.adat, szoveg);
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
    if (data === 'menu:limit') {
        await limitMenu(chatId);
        return true;
    }
    if (data === 'menu:adminok') {
        await adminokMenu(chatId);
        return true;
    }
    if (data === 'admin:uj') {
        await adminUjLink(chatId);
        return true;
    }
    if (data.startsWith('admin:torolMegerosit:')) {
        const cel = Number.parseInt(data.slice('admin:torolMegerosit:'.length), 10);
        if (Number.isFinite(cel)) await adminTorol(chatId, cel);
        return true;
    }
    if (data.startsWith('admin:torol:')) {
        const cel = Number.parseInt(data.slice('admin:torol:'.length), 10);
        if (Number.isFinite(cel)) await adminTorolMegerosites(chatId, cel);
        return true;
    }
    if (data === 'menu:arak') {
        await arakSzovegekMenu(chatId);
        return true;
    }
    if (data === 'arak:lista') {
        await arakMenu(chatId);
        return true;
    }
    if (data.startsWith('arak:svc:')) {
        await arSzolgaltatasMenu(chatId, data.slice('arak:svc:'.length));
        return true;
    }
    if (data.startsWith('arak:edit:')) {
        const reszek = data.slice('arak:edit:'.length).split(':');
        const cel = reszek[0] ?? '';
        if (cel === 'felar' || cel === 'energetika' || cel === 'kedvezmeny') await arSzerkesztesInditasa(chatId, cel, '', '');
        else await arSzerkesztesInditasa(chatId, cel, reszek[1] ?? '', reszek[2] ?? '0');
        return true;
    }
    if (data === 'szoveg:menu') {
        await szovegekMenu(chatId);
        return true;
    }
    if (data === 'szoveg:nevek') {
        await tetelNevekMenu(chatId);
        return true;
    }
    if (data === 'szoveg:pdf') {
        await pdfSzovegekMenu(chatId);
        return true;
    }
    if (data.startsWith('szoveg:nev:')) {
        await tetelNevInditasa(chatId, data.slice('szoveg:nev:'.length));
        return true;
    }
    if (data.startsWith('szoveg:mezo:')) {
        await szovegMezoInditasa(chatId, data.slice('szoveg:mezo:'.length));
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
    if (data === 'limit:toggle') {
        const k = await betoltKapcsolok();
        await mentsdKapcsolok({ ...k, napiLimit: !k.napiLimit }, String(chatId), 'Napi e-mail limit módosítás');
        await limitMenu(chatId);
        return true;
    }

    return false;
}
