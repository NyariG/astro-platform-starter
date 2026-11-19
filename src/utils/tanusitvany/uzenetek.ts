import { CEG } from '../../data/ceg';
import { KISZALLAS, NAGY_ALAPTERULET_M2, forint, type Arajanlat } from './arazas';
import type { TanusitvanyKeres } from './schema';

export type Level = { subject: string; html: string; text: string };

export function html(szoveg: string): string {
    return szoveg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function ft(osszeg: number | null, ha: string): string {
    return osszeg === null ? ha : forint(osszeg);
}

export function arSorok(ar: Arajanlat): [string, string][] {
    const tavolsag = ar.km === null ? 'nem szerepel a listában' : `${ar.km.toLocaleString('hu-HU')} km`;
    return [
        ['Épület', ar.tipusNev + (ar.nagy ? ` (${NAGY_ALAPTERULET_M2} m² felett)` : '')],
        ['Település', ar.telepules],
        [`Távolság (${KISZALLAS.kiindulas})`, tavolsag],
        ['Alapdíj', ft(ar.alapdij, 'egyedi ajánlat')],
        ['Kiszállás', ft(ar.kiszallas, 'egyedi ajánlat')],
        ['Végösszeg', ft(ar.vegosszeg, 'egyedi ajánlat')]
    ];
}

function tablazat(sorok: [string, string][]): string {
    return `<table cellpadding="6" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${sorok
        .map(([k, v]) => `<tr><td style="color:#64748b;border-bottom:1px solid #e2e8f0">${html(k)}</td><td style="border-bottom:1px solid #e2e8f0"><b>${html(v)}</b></td></tr>`)
        .join('')}</table>`;
}

function szovegesTabla(sorok: [string, string][]): string {
    return sorok.map(([k, v]) => `${k}: ${v}`).join('\n');
}

function ugyfelSorok(keres: TanusitvanyKeres): [string, string][] {
    return [
        ['Név', keres.nev],
        ['Telefon', keres.telefon],
        ['E-mail', keres.email],
        ['Mikor', keres.mikor || '–']
    ];
}

export function adminLevel(keres: TanusitvanyKeres, ar: Arajanlat): Level {
    const sorok = [...arSorok(ar), ...ugyfelSorok(keres)];
    return {
        subject: `Tanúsítvány-ajánlatkérés: ${keres.nev}, ${ar.telepules} – ${ft(ar.vegosszeg, 'egyedi')}`,
        html: `<p style="font-family:Arial,sans-serif">Új energetikai tanúsítvány-ajánlatkérés érkezett a honlapról.</p>${tablazat(sorok)}`,
        text: `Új energetikai tanúsítvány-ajánlatkérés érkezett a honlapról.\n\n${szovegesTabla(sorok)}`
    };
}

export function ugyfelLevel(keres: TanusitvanyKeres, ar: Arajanlat): Level {
    const sorok = arSorok(ar);
    const arMondat =
        ar.vegosszeg === null
            ? 'Az Ön esetében az árat egyedileg határozom meg, hamarosan jelentkezem a pontos ajánlattal.'
            : `A tanúsítvány díja a megadott adatok alapján ${forint(ar.vegosszeg)}, kiszállással együtt.`;
    const zaras = `Hamarosan felhívom a megadott telefonszámon (${keres.telefon}), hogy egyeztessük a helyszíni felmérés időpontját.`;
    const alairas = `Üdvözlettel:\nNyári Gergő Mátyás\n${CEG.nev}\n${CEG.telefon} · ${CEG.email}`;
    return {
        subject: 'Energetikai tanúsítvány – ajánlatkérését megkaptuk',
        html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a"><p>Kedves ${html(keres.nev)}!</p><p>Köszönöm az ajánlatkérést. ${html(arMondat)}</p>${tablazat(sorok)}<p>${html(zaras)}</p><p>${html(alairas).replace(/\n/g, '<br>')}</p></div>`,
        text: `Kedves ${keres.nev}!\n\nKöszönöm az ajánlatkérést. ${arMondat}\n\n${szovegesTabla(sorok)}\n\n${zaras}\n\n${alairas}`
    };
}

export function telegramUzenet(keres: TanusitvanyKeres, ar: Arajanlat): string {
    const sorok = [...arSorok(ar), ...ugyfelSorok(keres)];
    return `🏠 <b>Új tanúsítvány-ajánlatkérés</b>\n\n${sorok.map(([k, v]) => `${html(k)}: <b>${html(v)}</b>`).join('\n')}`;
}
