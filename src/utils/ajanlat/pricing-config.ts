export const ARLISTA_VERZIO = '2026-07-20';

export const HOTERMELO_FELAR = 30_000;

export const KEDVEZMENY_SZAZALEK = 5;

export const ENERGETIKAI_TANUSITVANY_DIJ = 30_000;

export type TeruletFajta = 'epulet' | 'telek' | 'ontozes';

export type Sav = {

    max: number;
    ar: number;
};

type SavosArazas = {
    tipus: 'sav';
    teruletFajta: TeruletFajta;
    savok: readonly Sav[];

    egyediUzenet: string;
};

type FixArazas = {
    tipus: 'fix';
    ar: number;
};

type EgysegaraArazas = {
    tipus: 'egysegar';
    teruletFajta: TeruletFajta;
    egysegar: number;
    minimumDij: number;
};

export type Arazas = SavosArazas | FixArazas | EgysegaraArazas;

export type Szolgaltatas = {
    kod: string;
    megnevezes: string;
    arazas: Arazas;
};

export const SZOLGALTATASOK = [
    {
        kod: 'muszaki_leiras',
        megnevezes: 'Műszaki leírás (egyszerű bejelentéshez)',
        arazas: { tipus: 'fix', ar: 60_000 }
    },
    {
        kod: 'futesi_terv',
        megnevezes: 'Fűtési terv',
        arazas: {
            tipus: 'sav',
            teruletFajta: 'epulet',
            savok: [
                { max: 102, ar: 200_000 },
                { max: 153, ar: 230_000 },
                { max: 200, ar: 240_000 }
            ],
            egyediUzenet: 'A 200 négyzetméter feletti fűtési tervek elkészítésére egyedi árazás vonatkozik. Kollégánk hamarosan felveszi Önnel a kapcsolatot.'
        }
    },
    {
        kod: 'klimaterv',
        megnevezes: 'Klímaterv',
        arazas: { tipus: 'fix', ar: 50_000 }
    },
    {
        kod: 'szellozteto_terv',
        megnevezes: 'Szellőztetési terv',
        arazas: {
            tipus: 'sav',
            teruletFajta: 'epulet',
            savok: [
                { max: 102, ar: 150_000 },
                { max: 153, ar: 190_000 },
                { max: 200, ar: 200_000 }
            ],
            egyediUzenet:
                'A 200 négyzetméter feletti szellőztetési tervek elkészítésére egyedi árazás vonatkozik. Kollégánk hamarosan felveszi Önnel a kapcsolatot.'
        }
    },
    {
        kod: 'vizellatas_terv',
        megnevezes: 'Vízellátási terv',
        arazas: {
            tipus: 'sav',
            teruletFajta: 'epulet',
            savok: [
                { max: 102, ar: 110_000 },
                { max: 153, ar: 120_000 },
                { max: 200, ar: 125_000 }
            ],
            egyediUzenet: 'A 200 négyzetméter feletti vízellátási tervek elkészítésére egyedi árazás vonatkozik. Kollégánk hamarosan felveszi Önnel a kapcsolatot.'
        }
    },
    {
        kod: 'esoviz_szikkasztas',
        megnevezes: 'Esővíz szikkasztási terv',
        arazas: {
            tipus: 'sav',
            teruletFajta: 'epulet',
            savok: [{ max: 200, ar: 100_000 }],
            egyediUzenet:
                'A 200 négyzetméter feletti esővíz szikkasztási tervek elkészítésére egyedi árazás vonatkozik. Kollégánk hamarosan felveszi Önnel a kapcsolatot.'
        }
    },
    {
        kod: 'kozponti_porszivo',
        megnevezes: 'Központi porszívó terv',
        arazas: {
            tipus: 'sav',
            teruletFajta: 'epulet',
            savok: [{ max: 200, ar: 90_000 }],
            egyediUzenet:
                'A 200 négyzetméter feletti Központi porszívó tervek elkészítésére egyedi árazás vonatkozik. Kollégánk hamarosan felveszi Önnel a kapcsolatot.'
        }
    },
    {
        kod: 'kert_koncepcio',
        megnevezes: 'Kertépítés — koncepcióterv',
        arazas: {
            tipus: 'sav',
            teruletFajta: 'telek',
            savok: [
                { max: 500, ar: 75_000 },
                { max: 850, ar: 100_000 },
                { max: 1100, ar: 120_000 }
            ],
            egyediUzenet: 'A 1100 négyzetméter feletti koncepció tervek elkészítésére egyedi árazás vonatkozik. Kollégánk hamarosan felveszi Önnel a kapcsolatot.'
        }
    },
    {
        kod: 'kert_kiviteli',
        megnevezes: 'Kertépítés — kiviteli terv',
        arazas: {
            tipus: 'sav',
            teruletFajta: 'telek',
            savok: [
                { max: 500, ar: 250_000 },
                { max: 850, ar: 300_000 },
                { max: 1100, ar: 350_000 }
            ],
            egyediUzenet: 'A 1100 négyzetméter feletti kiviteli tervek elkészítésére egyedi árazás vonatkozik. Kollégánk hamarosan felveszi Önnel a kapcsolatot.'
        }
    },
    {
        kod: 'ontozorendszer',
        megnevezes: 'Automata öntözőrendszer kivitelezési terv',
        arazas: { tipus: 'egysegar', teruletFajta: 'ontozes', egysegar: 109, minimumDij: 40_000 }
    }
] as const satisfies readonly Szolgaltatas[];

export type SzolgaltatasKod = (typeof SZOLGALTATASOK)[number]['kod'];

export const SZOLGALTATAS_KODOK = SZOLGALTATASOK.map((sz) => sz.kod);

export const FUTESI_TERV = 'futesi_terv';

export const KLIMATERV = 'klimaterv';

export function szolgaltatasKodSzerint(kod: string): Szolgaltatas | undefined {
    return SZOLGALTATASOK.find((sz) => sz.kod === kod);
}

export function teruletFajtaja(kod: string): TeruletFajta | null {
    const arazas = szolgaltatasKodSzerint(kod)?.arazas;
    if (!arazas || arazas.tipus === 'fix') return null;
    return arazas.teruletFajta;
}

export function szuksegesTeruletek(kodok: readonly string[]): TeruletFajta[] {
    const halmaz = new Set<TeruletFajta>();
    for (const kod of kodok) {
        const fajta = teruletFajtaja(kod);
        if (fajta) halmaz.add(fajta);
    }
    return [...halmaz];
}

export function savKonfigHibak(szolgaltatasok: readonly Szolgaltatas[] = SZOLGALTATASOK): string[] {
    const hibak: string[] = [];

    for (const szolgaltatas of szolgaltatasok) {
        const arazas = szolgaltatas.arazas;
        if (arazas.tipus !== 'sav') continue;

        if (arazas.savok.length === 0) {
            hibak.push(`${szolgaltatas.kod}: a sávos árazásnak legalább egy sávot tartalmaznia kell.`);
            continue;
        }

        let elozoMax = 0;
        arazas.savok.forEach((sav, index) => {
            const cimke = `${szolgaltatas.kod} / ${index + 1}. sáv`;
            if (!Number.isInteger(sav.max) || sav.max <= 0) {
                hibak.push(`${cimke}: a felső határ nem pozitív egész (${sav.max}).`);
            }
            if (sav.max <= elozoMax) {
                hibak.push(`${cimke}: a sávok nem szigorúan növekvők (${elozoMax} → ${sav.max}), így hézag vagy átfedés keletkezhet.`);
            }
            if (!Number.isInteger(sav.ar) || sav.ar < 0) {
                hibak.push(`${cimke}: az ár nem érvényes, nem negatív egész (${sav.ar}).`);
            }
            elozoMax = sav.max;
        });
    }

    return hibak;
}
