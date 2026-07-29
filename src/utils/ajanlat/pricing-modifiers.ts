import type { TeruletFajta } from './pricing-config';

export const SZORZO_MIN = 0.1;
export const SZORZO_MAX = 5;

export type AreaModifier =
    | { tipus: 'szazalek'; ertek: number }
    | { tipus: 'tort'; szamlalo: number; nevezo: number }
    | { tipus: 'tizedes'; ertek: string }
    | { tipus: 'fix'; ertek: number };

export const TERULETI_SZORZOK: Record<TeruletFajta, AreaModifier> = {
    epulet: { tipus: 'tizedes', ertek: '1' },
    telek: { tipus: 'tizedes', ertek: '1' },
    ontozes: { tipus: 'tizedes', ertek: '1' }
};

function tizedesTort(szoveg: string): { szamlalo: number; nevezo: number } {
    const trimmelt = szoveg.trim();
    const negativ = trimmelt.startsWith('-');
    const abs = trimmelt.replace(/^[+-]/, '');
    const [egesz, tort = ''] = abs.split('.');
    const nevezo = 10 ** tort.length;
    const szamlalo = Number.parseInt(egesz + tort, 10);
    return { szamlalo: (negativ ? -1 : 1) * szamlalo, nevezo: nevezo || 1 };
}

function kanonikus(mod: AreaModifier): { szamlalo: number; nevezo: number; szorzo: boolean } {
    switch (mod.tipus) {
        case 'szazalek':

            return { szamlalo: 100 + mod.ertek, nevezo: 100, szorzo: true };
        case 'tort':
            return { szamlalo: mod.szamlalo, nevezo: mod.nevezo, szorzo: true };
        case 'tizedes': {
            const { szamlalo, nevezo } = tizedesTort(mod.ertek);
            return { szamlalo, nevezo, szorzo: true };
        }
        case 'fix':

            return { szamlalo: mod.ertek, nevezo: 1, szorzo: false };
    }
}

export function modositoHiba(mod: AreaModifier): string | null {
    if (mod.tipus === 'tort') {
        if (!Number.isInteger(mod.szamlalo) || !Number.isInteger(mod.nevezo)) return 'A tört számlálója és nevezője is egész szám kell legyen.';
        if (mod.nevezo === 0) return 'A nevező nem lehet nulla.';
    }
    if (mod.tipus === 'szazalek' && !Number.isFinite(mod.ertek)) return 'Érvénytelen százalékérték.';
    if (mod.tipus === 'tizedes' && !/^[+-]?\d+(\.\d+)?$/.test(mod.ertek.trim())) return 'Érvénytelen tizedes szorzó.';
    if (mod.tipus === 'fix' && !Number.isInteger(mod.ertek)) return 'A fix eltolás egész forint kell legyen.';

    if (mod.tipus !== 'fix') {
        const { szamlalo, nevezo } = kanonikus(mod);
        const szorzo = szamlalo / nevezo;
        if (!Number.isFinite(szorzo)) return 'A szorzó nem értelmezhető.';
        if (szorzo < SZORZO_MIN || szorzo > SZORZO_MAX) {
            return `A szorzó ${SZORZO_MIN} és ${SZORZO_MAX} között lehet (a megadott: ${szorzo.toFixed(3)}×).`;
        }
    }
    return null;
}

/**
 * A módosító alkalmazása egy egész forint árra.
 *
 * Egész aritmetika: `round(ar * szamlalo / nevezo)`. Érvénytelen módosítónál
 * (amit a `modositoHiba` külön jelez) az eredeti árat adja vissza, hogy egy
 * konfighiba soha ne állítson elő NaN-t vagy abszurd összeget.
 */
export function alkalmazModosito(ar: number, mod: AreaModifier): number {
    if (modositoHiba(mod) !== null) return ar;
    if (mod.tipus === 'fix') return ar + mod.ertek;

    const { szamlalo, nevezo } = kanonikus(mod);
    return Math.round((ar * szamlalo) / nevezo);
}

/** Egy módosító normalizált, ember által olvasható alakja, pl. "×1,15 (+15%)". */
export function modositoLeiras(mod: AreaModifier): string {
    if (mod.tipus === 'fix') {
        const jel = mod.ertek >= 0 ? '+' : '−';
        return `${jel}${Math.abs(mod.ertek).toLocaleString('hu-HU')} Ft`;
    }
    const { szamlalo, nevezo } = kanonikus(mod);
    const szorzo = szamlalo / nevezo;
    const szazalek = Math.round((szorzo - 1) * 1000) / 10;
    const szorzoSzoveg = szorzo.toLocaleString('hu-HU', { maximumFractionDigits: 4 });
    if (szazalek === 0) return `×${szorzoSzoveg} (nincs változás)`;
    const jel = szazalek > 0 ? '+' : '−';
    return `×${szorzoSzoveg} (${jel}${Math.abs(szazalek).toLocaleString('hu-HU')}%)`;
}

/** Van-e a területre az identitástól eltérő, érvényes módosító. */
export function vanModosito(fajta: TeruletFajta): boolean {
    const mod = TERULETI_SZORZOK[fajta];
    if (modositoHiba(mod) !== null) return false;
    return alkalmazModosito(1000, mod) !== 1000;
}
