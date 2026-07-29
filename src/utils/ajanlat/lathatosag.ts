import { FUTESI_TERV, KLIMATERV, szuksegesTeruletek, type TeruletFajta } from './pricing-config';

export const KERT_KODOK = ['kert_koncepcio', 'kert_kiviteli', 'ontozorendszer'] as const;

const HOSZIVATTYU = 'hoszivattyu';

const HUTES_ALOPCIO = ['fan_coil', 'mennyezet'] as const;

export function normalizalAllapot<T extends LathatosagBemenet>(v: T): T {
    const klimaNelkul = (s: string[]) => s.filter((k) => k !== KLIMATERV);

    if (!v.hutesTervAktiv) {
        return { ...v, szolgaltatasok: klimaNelkul(v.szolgaltatasok), hutesOpciok: [], mennyezetHutes: '' };
    }

    if (v.mennyezetHutes !== 'igen') {
        return { ...v, szolgaltatasok: klimaNelkul(v.szolgaltatasok), hutesOpciok: [] };
    }

    if (!v.hotermelok.includes(HOSZIVATTYU)) {
        return { ...v, hutesOpciok: v.hutesOpciok.filter((o) => !HUTES_ALOPCIO.includes(o as (typeof HUTES_ALOPCIO)[number])) };
    }
    return v;
}

export type LathatosagBemenet = {
    szolgaltatasok: string[];
    hotermelok: string[];
    mennyezetHutes: string;
    hutesOpciok: string[];

    hutesTervAktiv: boolean;

    kertepitesAktiv: boolean;
};

export function effektivUrlap<T extends LathatosagBemenet>(v: T): T {

    const alap = normalizalAllapot(v);
    const bent = new Set(alap.szolgaltatasok);

    if (!alap.kertepitesAktiv) {
        for (const kod of KERT_KODOK) bent.delete(kod);
    }

    let hotermelok = alap.hotermelok;
    let hutesOpciok = alap.hutesOpciok;

    if (!bent.has(FUTESI_TERV)) {
        hotermelok = [];
        hutesOpciok = hutesOpciok.filter((o) => !HUTES_ALOPCIO.includes(o as (typeof HUTES_ALOPCIO)[number]));
    }

    return {
        ...alap,
        szolgaltatasok: alap.szolgaltatasok.filter((s) => bent.has(s)),
        hotermelok,
        hutesOpciok
    };
}

export type MezoLathatosag = {
    alapterulet: boolean;
    telekMeret: boolean;
    ontozendoTerulet: boolean;
    hotermelok: boolean;

    hutesKerdes: boolean;

    hutesAlopciok: boolean;

    fanCoilMennyezet: boolean;

    kertGyerekek: boolean;
};

export function mezoLathato(v: LathatosagBemenet): MezoLathatosag {
    const eff = effektivUrlap(v);
    const szuks = new Set<TeruletFajta>(szuksegesTeruletek(eff.szolgaltatasok));
    const hutesIgen = v.hutesTervAktiv && v.mennyezetHutes === 'igen';

    return {
        alapterulet: szuks.has('epulet'),
        telekMeret: szuks.has('telek'),
        ontozendoTerulet: szuks.has('ontozes'),
        hotermelok: eff.szolgaltatasok.includes(FUTESI_TERV),
        hutesKerdes: v.hutesTervAktiv,
        hutesAlopciok: hutesIgen,

        fanCoilMennyezet: hutesIgen && v.hotermelok.includes(HOSZIVATTYU),
        kertGyerekek: v.kertepitesAktiv
    };
}

export function kliensExtraHibak(v: LathatosagBemenet): Record<string, string> {
    const hibak: Record<string, string> = {};

    if (v.hutesTervAktiv && v.mennyezetHutes === '') {
        hibak.mennyezetHutes = 'Válaszoljon a mennyezet hűtésre vonatkozó kérdésre.';
    }

    if (v.kertepitesAktiv && !KERT_KODOK.some((k) => v.szolgaltatasok.includes(k))) {
        hibak.kertepites = 'Válasszon legalább egy kertépítési szolgáltatást.';
    }

    return hibak;
}
