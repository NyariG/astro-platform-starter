import type { QuoteRecord } from './store';
import type { InlineButton } from './telegram';
import { ezresPont, kerekitEzresre } from './pdf/format';
import { INGATLAN_JELLEG, SZOLGALTATAS_OPCIOK, labelOf, labelsOf } from './options';

const SEP = '────────────────';
const MAX_HOSSZ = 4096;
const TIME_ZONE = 'Europe/Budapest';

export type UjAjanlatUzenet = { szoveg: string; keyboard?: InlineButton[][] };
export type UzenetOpciok = { baseUrl?: string | null; maxHossz?: number };

function esc(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function penz(osszeg: number): string {
    return `${ezresPont(osszeg)},- Ft`;
}

function idopontBudapest(iso: string): string {
    return new Intl.DateTimeFormat('hu-HU', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(iso));
}

function tetelSor(megnevezes: string, arSzoveg: string): string {
    return `• ${esc(megnevezes)} — ${arSzoveg}`;
}

function osszeallit(felso: string[], tetelSorok: string[], also: string[], maxHossz: number): string {
    const teljes = [...felso, ...tetelSorok, ...also].join('\n');
    if (teljes.length <= maxHossz) return teljes;

    const megjeleno: string[] = [];
    for (let i = 0; i < tetelSorok.length; i++) {
        const maradek = tetelSorok.length - i - 1;
        const jelzoSor = `• +${maradek + 1} további tétel`;
        const proba = [...felso, ...megjeleno, tetelSorok[i], jelzoSor, ...also].join('\n');
        if (proba.length > maxHossz) break;
        megjeleno.push(tetelSorok[i]);
    }

    const kihagyott = tetelSorok.length - megjeleno.length;
    const sorok = kihagyott > 0 ? [...megjeleno, `• +${kihagyott} további tétel`] : megjeleno;
    return [...felso, ...sorok, ...also].join('\n');
}

export function ujAjanlatUzenet(record: QuoteRecord, opciok: UzenetOpciok = {}): UjAjanlatUzenet {
    const maxHossz = opciok.maxHossz ?? MAX_HOSSZ;

    const fejlec = ['🏢 <b>Nyári Terv · Új árajánlatkérés</b>'];

    const ugyfel = [
        '👤 <b>Ügyfél</b>',
        esc(record.nev),
        `✉️ ${esc(record.email)}${record.telefon ? ` · 📞 ${esc(record.telefon)}` : ''}`,
        `🏠 ${esc(labelOf(INGATLAN_JELLEG, record.ingatlanJelleg))}${record.varos ? ` · ${esc(record.varos)}` : ''}`
    ];

    const tetelFejlec = ['🧾 <b>Kért tervezési szolgáltatások</b>'];
    const tetelSorok = record.tetelek
        .filter((t) => t.status !== 'INCOMPLETE')
        .map((t) => (t.status === 'PRICED' && t.osszeg !== null ? tetelSor(t.megnevezes, penz(t.osszeg)) : tetelSor(t.megnevezes, 'egyedi árajánlat szerint')));
    if (tetelSorok.length === 0) tetelSorok.push('• —');

    const egyedi = record.vanEgyediArazas || record.vegosszeg === null;
    const osszegzes = ['💰 <b>Összegzés</b>', `Részösszeg — ${penz(record.reszosszeg)}`];
    if (record.kedvezmeny) osszegzes.push(`${esc(record.kedvezmeny.cimke)} — −${penz(record.kedvezmeny.osszeg)}`);
    if (egyedi || record.vegosszeg === null) {
        osszegzes.push('<b>Végösszeg — Egyedi felmérés után</b>');
    } else {
        osszegzes.push(`Végösszeg — ${penz(record.vegosszeg)}`);
        osszegzes.push(`<b>Fizetendő — ${penz(kerekitEzresre(record.vegosszeg))}</b>`);
    }

    const lablec = [`🕒 ${idopontBudapest(record.createdAt)} · #${esc(record.id.slice(0, 8))}`];

    const egyediBlokk: string[] = [];
    if (record.egyediLeiras) {
        egyediBlokk.push(SEP, `✍️ <b>Ügyfél egyedi leírása</b>${record.softLock ? ' (soft-lock — gépi árazás kihagyva)' : ''}`, esc(record.egyediLeiras));
        if (record.softLock && record.szolgaltatasok.length > 0) {
            egyediBlokk.push(`<i>Nézegetett opciók (kontextus): ${esc(labelsOf(SZOLGALTATAS_OPCIOK, record.szolgaltatasok).join(', '))}</i>`);
        }
    }

    const felso = [...fejlec, SEP, ...ugyfel, SEP, ...tetelFejlec];
    const also = [...egyediBlokk, SEP, ...osszegzes, SEP, ...lablec];
    const szoveg = osszeallit(felso, tetelSorok, also, maxHossz);

    const baseUrl = opciok.baseUrl ? opciok.baseUrl.replace(/\/+$/, '') : null;
    const keyboard: InlineButton[][] | undefined = baseUrl ? [[{ text: '📄 Ajánlat PDF megnyitása', url: `${baseUrl}/api/ajanlat-pdf?id=${encodeURIComponent(record.id)}` }]] : undefined;

    return keyboard ? { szoveg, keyboard } : { szoveg };
}
