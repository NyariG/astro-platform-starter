import telepulesek from '../../data/telepulesek-abda.json';

export const EPULET_TIPUSOK = {
    lakas: { nev: 'Társasházi lakás', ar: 30000 },
    sorhaz: { nev: 'Sorház', ar: 35000 },
    'haz-egyszintes': { nev: 'Családi ház, egyszintes', ar: 35000 },
    'haz-tobbszintes': { nev: 'Családi ház, többszintes', ar: 42000 }
} as const;

export type EpuletTipus = keyof typeof EPULET_TIPUSOK;

export const EPULET_TIPUS_KODOK = Object.keys(EPULET_TIPUSOK) as [EpuletTipus, ...EpuletTipus[]];

export const KISZALLAS = {
    kiindulas: 'Abda',
    ingyenesKm: 15,
    savKm: 5,
    savDij: 2000
} as const;

export const NAGY_ALAPTERULET_M2 = 200;

export type Telepules = { nev: string; km: number };

const TELEPULESEK = telepulesek as Telepules[];

function normalizal(szoveg: string): string {
    return szoveg.trim().replace(/\s+/g, ' ').toLocaleLowerCase('hu');
}

const TELEPULES_INDEX = new Map(TELEPULESEK.map((t) => [normalizal(t.nev), t]));

export function telepulesKeres(nev: string): Telepules | null {
    return TELEPULES_INDEX.get(normalizal(nev)) ?? null;
}

export function kiszallasDij(km: number): number {
    if (km <= KISZALLAS.ingyenesKm) return 0;
    return Math.ceil((km - KISZALLAS.ingyenesKm) / KISZALLAS.savKm) * KISZALLAS.savDij;
}

export type Arajanlat = {
    tipus: EpuletTipus;
    tipusNev: string;
    nagy: boolean;
    telepules: string;
    telepulesIsmert: boolean;
    km: number | null;
    alapdij: number | null;
    kiszallas: number | null;
    vegosszeg: number | null;
};

export function arajanlat(tipus: EpuletTipus, telepulesNev: string, nagy: boolean): Arajanlat {
    const telepules = telepulesKeres(telepulesNev);
    const alapdij = nagy ? null : EPULET_TIPUSOK[tipus].ar;
    const kiszallas = telepules ? kiszallasDij(telepules.km) : null;
    return {
        tipus,
        tipusNev: EPULET_TIPUSOK[tipus].nev,
        nagy,
        telepules: telepules?.nev ?? telepulesNev.trim(),
        telepulesIsmert: Boolean(telepules),
        km: telepules?.km ?? null,
        alapdij,
        kiszallas,
        vegosszeg: alapdij !== null && kiszallas !== null ? alapdij + kiszallas : null
    };
}

export function forint(osszeg: number): string {
    return `${new Intl.NumberFormat('hu-HU').format(osszeg)} Ft`;
}
