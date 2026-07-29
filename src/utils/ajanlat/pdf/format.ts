import type { Tetel } from '../pricing';
import { INGATLAN_JELLEG, labelOf } from '../options';

const TIME_ZONE = 'Europe/Budapest';

export function ezresPont(ertek: number): string {
    return Math.round(ertek)
        .toString()
        .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function negyzetmeterErtek(ertek: number): string {
    return ezresPont(ertek);
}

export function kerekitEzresre(osszeg: number): number {
    return Math.ceil(osszeg / 1000) * 1000;
}

export function arSzoveg(tetel: Tetel): string {
    if (tetel.status === 'PRICED' && tetel.osszeg !== null) {
        return `${ezresPont(kerekitEzresre(tetel.osszeg))},- Ft`;
    }
    return 'egyedi árajánlat szerint';
}

/** Fix összeg megjelenítése a PDF-ben (pl. a műszaki leírás díja): 60000 → „60.000,- Ft". */
export function fixArSzoveg(osszeg: number): string {
    return `${ezresPont(kerekitEzresre(osszeg))},- Ft`;
}

const SZINTNEV: Record<number, string> = {
    1: 'földszintes',
    2: 'kétszintes',
    3: 'háromszintes',
    4: 'négyszintes',
    5: 'ötszintes',
    6: 'hatszintes',
    7: 'hétszintes',
    8: 'nyolcszintes',
    9: 'kilencszintes',
    10: 'tízszintes'
};

/**
 * A szintszám és a pince együttes, jelzős szövege — a sablon így használja:
 * „egy [SZINTEK_SZAMA], összesen kb. … m² alapterületű [INGATLAN_JELLEGE]".
 *
 * Példák: (2, null) → „kétszintes" · (1, true) → „földszintes, pincével"
 * · (null, true) → „pincével rendelkező" · (null, null) → „épület".
 */
export function szintekSzoveg(szintek: number | null, pince: boolean | null): string {
    const alap = szintek === null ? '' : (SZINTNEV[szintek] ?? `${szintek} szintes`);
    if (alap) return pince ? `${alap}, pincével` : alap;
    return pince ? 'pincével rendelkező' : 'épület';
}

/** Az ingatlan jellege kisbetűvel, a mondatba illesztve: „lakóépület". */
export function ingatlanJellegSzoveg(jelleg: string): string {
    return labelOf(INGATLAN_JELLEG, jelleg).toLowerCase();
}

/** Magyar, hosszú dátum budapesti idő szerint: „2026. július 25.". */
export function datumMagyar(iso: string = new Date().toISOString()): string {
    return new Intl.DateTimeFormat('hu-HU', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(iso));
}
