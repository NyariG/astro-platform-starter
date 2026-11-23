const SURUSEG: ReadonlyArray<readonly [number, number]> = [
    [0, 999.84],
    [5, 999.97],
    [10, 999.7],
    [15, 999.1],
    [20, 998.21],
    [25, 997.05],
    [30, 995.65],
    [35, 994.03],
    [40, 992.22],
    [45, 990.21],
    [50, 988.04],
    [55, 985.69],
    [60, 983.2],
    [65, 980.55],
    [70, 977.77],
    [75, 974.84],
    [80, 971.79],
    [85, 968.62],
    [90, 965.31],
    [95, 961.89],
    [100, 958.35],
    [105, 954.73],
    [110, 950.95],
    [120, 943.11]
];

export const PSV_ERTEKEK = [2.5, 3, 4, 5, 6, 8, 10] as const;
export const FUTES_MIN_P0 = 0.5;
export const FELSO_PONT_MIN_NYOMAS = 0.5;
export const HOMERSEKLET_MIN = 0;
export const HOMERSEKLET_MAX = 100;

function homersekletRendben(...ertekek: Array<number | undefined>): boolean {
    return ertekek.every((t) => t === undefined || (t >= HOMERSEKLET_MIN && t <= HOMERSEKLET_MAX));
}

const HOMERSEKLET_HIBA = `A hőmérséklet ${HOMERSEKLET_MIN} és ${HOMERSEKLET_MAX} °C között legyen.`;

export type FutesBemenet = {
    terfogat: number;
    tMin: number;
    tMax: number;
    tTolt?: number;
    magassag: number;
    psv: number;
    tartaly?: number;
    tagulas?: number;
};

export type HmvBemenet = { terfogat: number; tHideg: number; tMax: number; pHideg: number; psv: number; tagulas?: number };

export type FutesEredmeny = {
    ok: true;
    p0: number;
    raHagyas: number;
    hidegNyomas: number;
    felsoPontNyomas: number;
    toltesiNyomas: number;
    toltesiHomerseklet: number;
    maxNyomas: number;
    vegnyomas: number;
    psv: number;
    surusegMin: number;
    surusegMax: number;
    tagulasSzazalek: number;
    tagulas: number;
    biztonsagiTerfogat: number;
    vMin: number;
    tartaly: number;
    figyelmeztetesek: string[];
};

export type HmvEredmeny = {
    ok: true;
    tagulas: number;
    elofeszites: number;
    vegnyomas: number;
    psv: number;
    pHideg: number;
    kihasznalas: number;
    maradvanyTenyezo: number;
    vMin: number;
    figyelmeztetesek: string[];
};

export type Hiba = { ok: false; hiba: string };

export function suruseg(t: number): number {
    const alsoHatar = SURUSEG[0];
    const felsoHatar = SURUSEG[SURUSEG.length - 1];
    if (t <= alsoHatar[0]) return alsoHatar[1];
    if (t >= felsoHatar[0]) return felsoHatar[1];
    for (let i = 1; i < SURUSEG.length; i++) {
        const [t1, r1] = SURUSEG[i];
        if (t <= t1) {
            const [t0, r0] = SURUSEG[i - 1];
            return r0 + ((r1 - r0) * (t - t0)) / (t1 - t0);
        }
    }
    return felsoHatar[1];
}

export function tagulasiTenyezo(tKezdo: number, tVeg: number): number {
    return Math.max(0, suruseg(tKezdo) / suruseg(tVeg) - 1);
}

function felfeleKerekit(ertek: number, lepes: number): number {
    return Math.round(Math.ceil(ertek / lepes - 1e-6) * lepes * 1000) / 1000;
}

function szamjegyre(ertek: number, jegy = 2): number {
    const szorzo = 10 ** jegy;
    return Math.round(ertek * szorzo) / szorzo;
}

export function elofeszites(magassag: number): { p0: number; raHagyas: number } {
    const statikus = magassag / 10;
    const p0 = Math.max(FUTES_MIN_P0, felfeleKerekit(statikus + FELSO_PONT_MIN_NYOMAS, 0.1));
    return { p0, raHagyas: szamjegyre(p0 - statikus) };
}

export function vegnyomasFutes(psv: number): number {
    return psv - Math.max(psv * 0.1, 0.5);
}

export function tartalyTerfogat(tagulas: number, biztonsagi: number, vegnyomas: number, p0: number): number {
    return ((tagulas + biztonsagi) * (vegnyomas + 1)) / (vegnyomas - p0);
}

export function gazNyomas(p0: number, tartaly: number, viz: number): number {
    return ((p0 + 1) * tartaly) / (tartaly - viz) - 1;
}

export function futesMeretezes(be: FutesBemenet): FutesEredmeny | Hiba {
    if (!(be.terfogat > 0)) return { ok: false, hiba: 'Adja meg a rendszer víztérfogatát.' };
    if (!(be.magassag >= 0) || be.magassag > 150) return { ok: false, hiba: 'A statikus magasság 0 és 150 m közötti szám legyen.' };
    if (!(be.psv > 0)) return { ok: false, hiba: 'Válassza ki a biztonsági szelep nyitónyomását.' };
    if (!homersekletRendben(be.tMin, be.tMax, be.tTolt)) return { ok: false, hiba: HOMERSEKLET_HIBA };
    if (!(be.tMax > be.tMin)) return { ok: false, hiba: 'A legmagasabb hőmérséklet legyen magasabb, mint a legalacsonyabb.' };
    const tTolt = be.tTolt ?? be.tMin;
    if (tTolt < be.tMin || tTolt > be.tMax) {
        return { ok: false, hiba: 'A töltési hőmérséklet a legalacsonyabb és a legmagasabb hőmérséklet között legyen.' };
    }

    const el = elofeszites(be.magassag);
    const vegnyomas = vegnyomasFutes(be.psv);

    if (vegnyomas - el.p0 < 0.3) {
        return {
            ok: false,
            hiba: `A biztonsági szelep nyomása (${be.psv} bar) túl alacsony a ${be.magassag} m statikus magassághoz: az előfeszítés ${el.p0} bar, a végnyomás csak ${szamjegyre(vegnyomas)} bar. Válasszon nagyobb nyomású szelepet és tartályt.`
        };
    }

    const figyelmeztetesek: string[] = [];
    const ajanlottPsv = el.p0 + (be.psv <= 5 ? 1.5 : 2);
    if (be.psv < ajanlottPsv - 1e-9) {
        figyelmeztetesek.push(`A gyártói ajánlás szerint a biztonsági szelep nyomása legalább p0 + ${be.psv <= 5 ? '1,5' : '2'} bar (${ajanlottPsv.toLocaleString('hu-HU')} bar) legyen.`);
    }

    const teljesTagulas = tagulasiTenyezo(be.tMin, be.tMax);
    const tagulasTenyezo = be.tagulas ?? teljesTagulas;
    const tagulasAdott = (t: number) => (be.tagulas !== undefined && teljesTagulas > 0 ? be.tagulas * (tagulasiTenyezo(be.tMin, t) / teljesTagulas) : tagulasiTenyezo(be.tMin, t));

    const tagulas = be.terfogat * tagulasTenyezo;
    const biztonsagiTerfogat = Math.max(3, be.terfogat * 0.005);
    const vMin = tartalyTerfogat(tagulas, biztonsagiTerfogat, vegnyomas, el.p0);
    const tartaly = Math.max(be.tartaly ?? vMin, vMin);

    const hidegNyomasPontos = gazNyomas(el.p0, tartaly, biztonsagiTerfogat);
    const hidegNyomas = felfeleKerekit(hidegNyomasPontos, 0.1);
    const nyomasAdott = (t: number) => gazNyomas(el.p0, tartaly, biztonsagiTerfogat + be.terfogat * tagulasAdott(t));
    const toltesiNyomas = felfeleKerekit(nyomasAdott(tTolt), 0.1);
    const maxNyomas = nyomasAdott(be.tMax);


    return {
        ok: true,
        p0: el.p0,
        raHagyas: el.raHagyas,
        hidegNyomas,
        felsoPontNyomas: szamjegyre(hidegNyomasPontos - be.magassag / 10),
        toltesiNyomas,
        toltesiHomerseklet: tTolt,
        maxNyomas: szamjegyre(maxNyomas),
        vegnyomas: szamjegyre(vegnyomas),
        psv: be.psv,
        surusegMin: szamjegyre(suruseg(be.tMin)),
        surusegMax: szamjegyre(suruseg(be.tMax)),
        tagulasSzazalek: szamjegyre(tagulasTenyezo * 100, 3),
        tagulas: szamjegyre(tagulas),
        biztonsagiTerfogat: szamjegyre(biztonsagiTerfogat),
        vMin: szamjegyre(vMin),
        tartaly: szamjegyre(tartaly),
        figyelmeztetesek
    };
}

export function hmvMeretezes(be: HmvBemenet): HmvEredmeny | Hiba {
    if (!(be.terfogat > 0)) return { ok: false, hiba: 'Adja meg a melegvíz-tároló térfogatát.' };
    if (!(be.pHideg > 0) || !(be.psv > 0)) return { ok: false, hiba: 'Adja meg a hálózati nyomást és a biztonsági szelep nyitónyomását.' };
    if (!homersekletRendben(be.tHideg, be.tMax)) return { ok: false, hiba: HOMERSEKLET_HIBA };
    if (be.tMax <= be.tHideg) return { ok: false, hiba: 'A legmagasabb hőmérséklet legyen magasabb, mint a hidegvíz hőmérséklete.' };

    const vegnyomas = be.psv * 0.9;
    if (vegnyomas - be.pHideg < 0.3) {
        return {
            ok: false,
            hiba: `A biztonsági szelep nyomása (${be.psv} bar) túl alacsony a ${be.pHideg} bar hálózati nyomáshoz: a végnyomás csak ${szamjegyre(vegnyomas)} bar. Nagyobb nyomású szelep kell, vagy nyomáscsökkentővel csökkentse a hálózati nyomást.`
        };
    }

    const tenyezo = be.tagulas ?? tagulasiTenyezo(be.tHideg, be.tMax);
    const tagulas = be.terfogat * tenyezo;
    const elofeszites = Math.round(be.pHideg * 10 - 2) / 10;
    const kihasznalas0 = (vegnyomas + 1 - (be.pHideg + 1)) / (vegnyomas + 1);
    const feltoltes = (be.pHideg + 1 - (elofeszites + 1)) / (be.pHideg + 1);
    const maradvany = 1 - feltoltes;
    const kihasznalas = kihasznalas0 * maradvany;
    const vMin = tagulas / kihasznalas;

    const figyelmeztetesek: string[] = [];
    if (be.psv < be.pHideg + 1.5) {
        figyelmeztetesek.push('A biztonsági szelep nyomása közel van a hálózati nyomáshoz, ilyenkor a tartály kihasználtsága kicsi, és a szelep könnyen megcsöpöghet.');
    }

    return {
        ok: true,
        tagulas: szamjegyre(tagulas, 3),
        elofeszites,
        vegnyomas: szamjegyre(vegnyomas),
        psv: be.psv,
        pHideg: be.pHideg,
        kihasznalas: szamjegyre(kihasznalas, 4),
        maradvanyTenyezo: szamjegyre(maradvany, 4),
        vMin: szamjegyre(vMin),
        figyelmeztetesek
    };
}
