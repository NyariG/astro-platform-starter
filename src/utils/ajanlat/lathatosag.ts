import { FUTESI_TERV, szuksegesTeruletek, type TeruletFajta } from './pricing-config';

export const KERT_KODOK = ['kert_koncepcio', 'kert_kiviteli', 'ontozorendszer'] as const;

const HOSZIVATTYU = 'hoszivattyu';

export type LathatosagBemenet = {
    szolgaltatasok: string[];
    hotermelok: string[];
    mennyezetHutes: string;
    hutesOpciok: string[];

    kertepitesAktiv: boolean;
};

function huthet(v: LathatosagBemenet): boolean {
    return v.szolgaltatasok.includes(FUTESI_TERV) && v.hotermelok.includes(HOSZIVATTYU);
}

export function normalizalAllapot<T extends LathatosagBemenet>(v: T): T {
    if (!huthet(v)) {
        return { ...v, mennyezetHutes: '', hutesOpciok: [] };
    }
    if (v.mennyezetHutes !== 'igen') {
        return { ...v, hutesOpciok: [] };
    }
    return v;
}

export function effektivUrlap<T extends LathatosagBemenet>(v: T): T {
    const alap = normalizalAllapot(v);
    const bent = new Set(alap.szolgaltatasok);

    if (!alap.kertepitesAktiv) {
        for (const kod of KERT_KODOK) bent.delete(kod);
    }

    const hotermelok = bent.has(FUTESI_TERV) ? alap.hotermelok : [];

    return {
        ...alap,
        szolgaltatasok: alap.szolgaltatasok.filter((s) => bent.has(s)),
        hotermelok,
        hutesOpciok: alap.hutesOpciok
    };
}

export type MezoLathatosag = {
    alapterulet: boolean;
    telekMeret: boolean;
    ontozendoTerulet: boolean;
    hotermelok: boolean;

    hutesKerdes: boolean;

    hutesAlopciok: boolean;

    kertGyerekek: boolean;
};

export function mezoLathato(v: LathatosagBemenet): MezoLathatosag {
    const eff = effektivUrlap(v);
    const szuks = new Set<TeruletFajta>(szuksegesTeruletek(eff.szolgaltatasok));
    const hutesheto = huthet(v);

    return {
        alapterulet: szuks.has('epulet'),
        telekMeret: szuks.has('telek'),
        ontozendoTerulet: szuks.has('ontozes'),
        hotermelok: eff.szolgaltatasok.includes(FUTESI_TERV),
        hutesKerdes: hutesheto,
        hutesAlopciok: hutesheto && v.mennyezetHutes === 'igen',
        kertGyerekek: v.kertepitesAktiv
    };
}

export function kliensExtraHibak(v: LathatosagBemenet): Record<string, string> {
    const hibak: Record<string, string> = {};
    const hutesheto = huthet(v);

    if (hutesheto && v.mennyezetHutes === '') {
        hibak.mennyezetHutes = 'Válaszoljon a hűtésre vonatkozó kérdésre.';
    }

    if (hutesheto && v.mennyezetHutes === 'igen' && v.hutesOpciok.length === 0) {
        hibak.hutesOpciok = 'Válasszon legalább egy hűtési opciót.';
    }

    if (v.kertepitesAktiv && !KERT_KODOK.some((k) => v.szolgaltatasok.includes(k))) {
        hibak.kertepites = 'Válasszon legalább egy kertépítési szolgáltatást.';
    }

    return hibak;
}
