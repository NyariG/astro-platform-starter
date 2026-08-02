import { describe, expect, it } from 'vitest';
import { calculateQuote, type QuoteInput } from './pricing';
import type { AreaModifier } from './pricing-modifiers';
import type { TeruletFajta } from './pricing-config';

const IDENTITAS: Record<TeruletFajta, AreaModifier> = {
    epulet: { tipus: 'tizedes', ertek: '1' },
    telek: { tipus: 'tizedes', ertek: '1' },
    ontozes: { tipus: 'tizedes', ertek: '1' }
};

function szorzokkal(felulir: Partial<Record<TeruletFajta, AreaModifier>>): Record<TeruletFajta, AreaModifier> {
    return { ...IDENTITAS, ...felulir };
}

function bemenet(felulir: Partial<QuoteInput> = {}): QuoteInput {
    return {
        szolgaltatasok: [],
        epuletTerulet: null,
        telekMeret: null,
        ontozendoTerulet: null,
        hotermelok: [],
        nincsHutes: false,
        ...felulir
    };
}

function tetel(kod: string, terulet: number | null, fajta: 'epulet' | 'telek' | 'ontozes' = 'epulet') {
    const mezo = fajta === 'epulet' ? 'epuletTerulet' : fajta === 'telek' ? 'telekMeret' : 'ontozendoTerulet';
    const eredmeny = calculateQuote(bemenet({ szolgaltatasok: [kod], [mezo]: terulet }));
    return eredmeny.tetelek[0];
}

const EPULET_HATAROK = [1, 101, 102, 103, 152, 153, 154, 199, 200, 201, 1000];

const EPULET_VART: Record<string, Record<number, number | 'EGYEDI'>> = {
    futesi_terv: {
        1: 200_000,
        101: 200_000,
        102: 200_000,
        103: 230_000,
        152: 230_000,
        153: 230_000,
        154: 240_000,
        199: 240_000,
        200: 240_000,
        201: 'EGYEDI',
        1000: 'EGYEDI'
    },
    szellozteto_terv: {
        1: 150_000,
        101: 150_000,
        102: 150_000,
        103: 190_000,
        152: 190_000,
        153: 190_000,
        154: 200_000,
        199: 200_000,
        200: 200_000,
        201: 'EGYEDI',
        1000: 'EGYEDI'
    },
    vizellatas_terv: {
        1: 110_000,
        101: 110_000,
        102: 110_000,
        103: 120_000,
        152: 120_000,
        153: 120_000,
        154: 125_000,
        199: 125_000,
        200: 125_000,
        201: 'EGYEDI',
        1000: 'EGYEDI'
    },
    esoviz_szikkasztas: {
        1: 100_000,
        101: 100_000,
        102: 100_000,
        103: 100_000,
        152: 100_000,
        153: 100_000,
        154: 100_000,
        199: 100_000,
        200: 100_000,
        201: 'EGYEDI',
        1000: 'EGYEDI'
    },
    kozponti_porszivo: {
        1: 90_000,
        101: 90_000,
        102: 90_000,
        103: 90_000,
        152: 90_000,
        153: 90_000,
        154: 90_000,
        199: 90_000,
        200: 90_000,
        201: 'EGYEDI',
        1000: 'EGYEDI'
    }
};

describe('sávhatárok — épület alapterület', () => {
    for (const [kod, varttabla] of Object.entries(EPULET_VART)) {
        describe(kod, () => {
            for (const terulet of EPULET_HATAROK) {
                const vart = varttabla[terulet];
                it(`${terulet} m² → ${vart === 'EGYEDI' ? 'egyedi árazás' : vart.toLocaleString('hu-HU') + ' Ft'}`, () => {
                    const t = tetel(kod, terulet);
                    if (vart === 'EGYEDI') {
                        expect(t.status).toBe('CUSTOM_QUOTE');
                        expect(t.osszeg).toBeNull();
                        expect(t.uzenet).toContain('egyedi árazás vonatkozik');
                    } else {
                        expect(t.status).toBe('PRICED');
                        expect(t.osszeg).toBe(vart);
                    }
                });
            }
        });
    }
});

// ─────────────────────────────────────────────────────────────
// Kertépítés — telekméret
// ─────────────────────────────────────────────────────────────

const TELEK_HATAROK = [1, 499, 500, 501, 849, 850, 851, 1099, 1100, 1101, 5000];

const TELEK_VART: Record<string, Record<number, number | 'EGYEDI'>> = {
    kert_koncepcio: {
        1: 75_000,
        499: 75_000,
        500: 75_000,
        501: 100_000,
        849: 100_000,
        850: 100_000,
        851: 120_000,
        1099: 120_000,
        1100: 120_000,
        1101: 'EGYEDI',
        5000: 'EGYEDI'
    },
    kert_kiviteli: {
        1: 250_000,
        499: 250_000,
        500: 250_000,
        501: 300_000,
        849: 300_000,
        850: 300_000,
        851: 350_000,
        1099: 350_000,
        1100: 350_000,
        1101: 'EGYEDI',
        5000: 'EGYEDI'
    }
};

describe('sávhatárok — kertépítés (telekméret)', () => {
    for (const [kod, varttabla] of Object.entries(TELEK_VART)) {
        describe(kod, () => {
            for (const terulet of TELEK_HATAROK) {
                const vart = varttabla[terulet];
                it(`${terulet} m² → ${vart === 'EGYEDI' ? 'egyedi árazás' : vart.toLocaleString('hu-HU') + ' Ft'}`, () => {
                    const t = tetel(kod, terulet, 'telek');
                    if (vart === 'EGYEDI') {
                        expect(t.status).toBe('CUSTOM_QUOTE');
                        expect(t.osszeg).toBeNull();
                    } else {
                        expect(t.osszeg).toBe(vart);
                    }
                });
            }
        });
    }
});

// ─────────────────────────────────────────────────────────────
// Öntözőrendszer — 109 Ft/m², minimum 40 000 Ft
// ─────────────────────────────────────────────────────────────

describe('öntözőrendszer — egységár és minimumdíj', () => {
    const esetek: [number, number][] = [
        [1, 40_000],
        [100, 40_000],
        [366, 40_000],
        [367, 40_003],
        [368, 40_112],
        [1000, 109_000],
        [10_000, 1_090_000]
    ];

    for (const [terulet, vart] of esetek) {
        it(`${terulet} m² → ${vart.toLocaleString('hu-HU')} Ft`, () => {
            const t = tetel('ontozorendszer', terulet, 'ontozes');
            expect(t.status).toBe('PRICED');
            expect(t.osszeg).toBe(vart);
        });
    }

    it('a fordulópontnál a minimum adja az árat, egy m²-rel fölötte az egységár', () => {
        expect(tetel('ontozorendszer', 366, 'ontozes').osszeg).toBe(40_000);
        expect(tetel('ontozorendszer', 367, 'ontozes').osszeg).toBe(40_003);
    });
});

// ─────────────────────────────────────────────────────────────
// Fix díjas tételek
// ─────────────────────────────────────────────────────────────

describe('fix díjas tételek', () => {
    it('a műszaki leírás 60 000 Ft, területtől függetlenül', () => {
        expect(tetel('muszaki_leiras', null).osszeg).toBe(60_000);
        expect(tetel('muszaki_leiras', 5000).osszeg).toBe(60_000);
    });

    it('a klímaterv 50 000 Ft, területtől függetlenül', () => {
        expect(tetel('klimaterv', null).osszeg).toBe(50_000);
        expect(tetel('klimaterv', 5000).osszeg).toBe(50_000);
    });
});

// ─────────────────────────────────────────────────────────────
// Hőtermelő felár és kedvezmény
// ─────────────────────────────────────────────────────────────

describe('hőtermelő felár', () => {
    it('minden hőtermelő 30 000 Ft — 3 db esetén 90 000 Ft', () => {
        const eredmeny = calculateQuote(
            bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 140, hotermelok: ['hoszivattyu', 'gazkazan', 'napkollektor'] })
        );
        const felar = eredmeny.tetelek.find((t) => t.kod === 'hotermelo_felar');
        expect(felar?.mennyiseg).toBe(3);
        expect(felar?.osszeg).toBe(90_000);
    });

    it('fűtési terv nélkül nincs felár', () => {
        const eredmeny = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv'], hotermelok: ['hoszivattyu'] }));
        expect(eredmeny.tetelek.find((t) => t.kod === 'hotermelo_felar')).toBeUndefined();
    });

    it('hőtermelő nélkül nincs felársor', () => {
        const eredmeny = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 100 }));
        expect(eredmeny.tetelek.find((t) => t.kod === 'hotermelo_felar')).toBeUndefined();
    });

    it('hiányzó alapterületnél a felár is hiányos állapotú', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv'], hotermelok: ['gazkazan'] }));
        expect(e.tetelek.find((t) => t.kod === 'hotermelo_felar')?.status).toBe('INCOMPLETE');
    });

    it('egyedi árazású fűtési terv esetén a felár is egyedi', () => {
        const eredmeny = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 210, hotermelok: ['hoszivattyu', 'gazkazan'] }));
        const felar = eredmeny.tetelek.find((t) => t.kod === 'hotermelo_felar');
        expect(felar?.status).toBe('CUSTOM_QUOTE');
        expect(felar?.osszeg).toBeNull();
    });

    it('a felár közvetlenül a fűtési terv után jelenik meg', () => {
        const eredmeny = calculateQuote(
            bemenet({ szolgaltatasok: ['muszaki_leiras', 'futesi_terv', 'klimaterv'], epuletTerulet: 100, hotermelok: ['gazkazan'] })
        );
        const kodok = eredmeny.tetelek.map((t) => t.kod);
        expect(kodok).toEqual(['muszaki_leiras', 'futesi_terv', 'hotermelo_felar', 'klimaterv']);
    });
});

describe('kedvezmény — „hűteni nem szükséges”', () => {
    it('1. eset: 100 m², 0 hőtermelő, nincs kedvezmény → 200 000', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 100 }));
        expect(e.kedvezmeny).toBeNull();
        expect(e.vegosszeg).toBe(200_000);
    });

    it('2. eset: 100 m², 0 hőtermelő, kedvezménnyel → 190 000', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 100, nincsHutes: true }));
        expect(e.kedvezmeny?.alap).toBe(200_000);
        expect(e.kedvezmeny?.osszeg).toBe(10_000);
        expect(e.vegosszeg).toBe(190_000);
    });

    it('3. eset: 140 m², 3 hőtermelő, kedvezménnyel → 304 000', () => {
        const e = calculateQuote(
            bemenet({
                szolgaltatasok: ['futesi_terv'],
                epuletTerulet: 140,
                hotermelok: ['hoszivattyu', 'gazkazan', 'napkollektor'],
                nincsHutes: true
            })
        );
        expect(e.kedvezmeny?.alap).toBe(320_000);
        expect(e.kedvezmeny?.osszeg).toBe(16_000);
        expect(e.vegosszeg).toBe(304_000);
    });

    it('4. eset: 210 m² (egyedi) + 2 hőtermelő + kedvezmény → nincs végösszeg, nincs kedvezménysor', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 210, hotermelok: ['hoszivattyu', 'gazkazan'], nincsHutes: true })
        );
        expect(e.vanEgyediArazas).toBe(true);
        expect(e.vegosszeg).toBeNull();
        expect(e.kedvezmeny).toBeNull();
    });

    it('5. eset: nincs fűtési terv, kedvezmény bejelölve → nincs kedvezménysor', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv'], nincsHutes: true }));
        expect(e.kedvezmeny).toBeNull();
        expect(e.vegosszeg).toBe(50_000);
    });

    it('a kedvezmény csak a fűtési blokkra vonatkozik, más tételekre nem', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['futesi_terv', 'klimaterv', 'vizellatas_terv'], epuletTerulet: 100, nincsHutes: true })
        );
        // 200 000 + 50 000 + 110 000 = 360 000, a kedvezmény alapja csak 200 000
        expect(e.reszosszeg).toBe(360_000);
        expect(e.kedvezmeny?.alap).toBe(200_000);
        expect(e.kedvezmeny?.osszeg).toBe(10_000);
        expect(e.vegosszeg).toBe(350_000);
    });

    it('a klímaterv és a kedvezmény együtt is választható', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv', 'klimaterv'], epuletTerulet: 100, nincsHutes: true }));
        expect(e.tetelek.map((t) => t.kod)).toContain('klimaterv');
        expect(e.kedvezmeny?.osszeg).toBe(10_000);
        expect(e.vegosszeg).toBe(240_000);
    });
});

// ─────────────────────────────────────────────────────────────
// Egyedi árazás és összesítés
// ─────────────────────────────────────────────────────────────

describe('területi szorzó — integráció', () => {
    it('az épület-szorzó a fűtési terv árára hat, a fix díjra nem', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['muszaki_leiras', 'futesi_terv'], epuletTerulet: 100, hotermelok: ['gazkazan'] }),
            szorzokkal({ epulet: { tipus: 'szazalek', ertek: 15 } })
        );
        const futes = e.tetelek.find((t) => t.kod === 'futesi_terv');
        const muszaki = e.tetelek.find((t) => t.kod === 'muszaki_leiras');
        // Fűtési terv 200 000 → +15% = 230 000, alapAr megőrizve
        expect(futes?.alapAr).toBe(200_000);
        expect(futes?.osszeg).toBe(230_000);
        expect(futes?.teruletiSzorzo).toContain('+15%');
        // Műszaki leírás fix 60 000, változatlan
        expect(muszaki?.osszeg).toBe(60_000);
        expect(muszaki?.teruletiSzorzo).toBeNull();
    });

    it('a hőtermelő felárra a szorzó nem hat', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 100, hotermelok: ['gazkazan', 'hoszivattyu'] }),
            szorzokkal({ epulet: { tipus: 'szazalek', ertek: 50 } })
        );
        const felar = e.tetelek.find((t) => t.kod === 'hotermelo_felar');
        expect(felar?.osszeg).toBe(60_000); // 2 × 30 000, szorzó nélkül
    });

    it('a telek-szorzó a kertépítésre hat, az épületre nem', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['vizellatas_terv', 'kert_koncepcio'], epuletTerulet: 100, telekMeret: 500 }),
            szorzokkal({ telek: { tipus: 'tort', szamlalo: 5, nevezo: 4 } })
        );
        const viz = e.tetelek.find((t) => t.kod === 'vizellatas_terv');
        const kert = e.tetelek.find((t) => t.kod === 'kert_koncepcio');
        expect(viz?.osszeg).toBe(110_000); // épület, érintetlen
        expect(kert?.osszeg).toBe(93_750); // 75 000 × 1,25
    });

    it('a szorzó a kedvezmény ELŐTT hat (jóváhagyott lánc)', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 100, hotermelok: ['gazkazan'], nincsHutes: true }),
            szorzokkal({ epulet: { tipus: 'szazalek', ertek: 10 } })
        );
        // Fűtési terv 200 000 → +10% = 220 000; + hőtermelő 30 000 = 250 000 blokk
        // 5% kedvezmény = 12 500 → végösszeg 237 500
        expect(e.kedvezmeny?.alap).toBe(250_000);
        expect(e.kedvezmeny?.osszeg).toBe(12_500);
        expect(e.vegosszeg).toBe(237_500);
    });

    it('fix eltolás összeadásként hat', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 100, hotermelok: ['gazkazan'] }),
            szorzokkal({ epulet: { tipus: 'fix', ertek: 5_000 } })
        );
        expect(e.tetelek.find((t) => t.kod === 'futesi_terv')?.osszeg).toBe(205_000);
    });

    it('identitás-szorzóval az ár bitre azonos, teruletiSzorzo null', () => {
        const a = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 140, hotermelok: ['gazkazan'] }));
        const b = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 140, hotermelok: ['gazkazan'] }), IDENTITAS);
        expect(a.vegosszeg).toBe(b.vegosszeg);
        expect(a.tetelek.every((t) => t.teruletiSzorzo === null)).toBe(true);
    });

    it('egyedi árazású tételre a szorzó nem értelmezett', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 250, hotermelok: ['gazkazan'] }),
            szorzokkal({ epulet: { tipus: 'szazalek', ertek: 15 } })
        );
        const futes = e.tetelek.find((t) => t.kod === 'futesi_terv');
        expect(futes?.status).toBe('CUSTOM_QUOTE');
        expect(futes?.osszeg).toBeNull();
    });
});

describe('pince — árazási invariancia', () => {
    it('a pince mező jelenléte nem befolyásolja az árat (bitre azonos)', () => {
        const alap = bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 120, hotermelok: ['gazkazan'], nincsHutes: true });
        const nelkul = calculateQuote(alap);
        // A pince nem is része a QuoteInput-nak; ha valaki később bekötné az
        // árazóba, ez a teszt azonnal elbukna.
        const vanPince = calculateQuote({ ...alap, pince: 'van' } as unknown as QuoteInput);
        const nincsPince = calculateQuote({ ...alap, pince: 'nincs' } as unknown as QuoteInput);
        expect(vanPince).toEqual(nelkul);
        expect(nincsPince).toEqual(nelkul);
    });

    it('több szolgáltatás-kombinációnál is invariáns', () => {
        const esetek = [
            bemenet({ szolgaltatasok: ['klimaterv'] }),
            bemenet({ szolgaltatasok: ['kert_koncepcio'], telekMeret: 800 }),
            bemenet({ szolgaltatasok: ['ontozorendszer'], ontozendoTerulet: 400 })
        ];
        for (const eset of esetek) {
            expect(calculateQuote({ ...eset, pince: 'van' } as unknown as QuoteInput)).toEqual(calculateQuote(eset));
        }
    });
});

describe('egyedi árazás', () => {
    it('bármely egyedi tétel elrejti a végösszeget', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv', 'futesi_terv'], epuletTerulet: 250 }));
        expect(e.vanEgyediArazas).toBe(true);
        expect(e.vegosszeg).toBeNull();
        // A részösszeg attól még kiszámolható marad a belső használatra.
        expect(e.reszosszeg).toBe(50_000);
    });

    it('az üzenetek szó szerint, tételenként jelennek meg', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv', 'vizellatas_terv'], epuletTerulet: 300 }));
        expect(e.figyelmeztetesek).toHaveLength(2);
        expect(e.figyelmeztetesek[0]).toBe(
            'A 200 négyzetméter feletti fűtési tervek elkészítésére egyedi árazás vonatkozik. Kollégánk hamarosan felveszi Önnel a kapcsolatot.'
        );
        expect(e.figyelmeztetesek[1]).toBe(
            'A 200 négyzetméter feletti vízellátási tervek elkészítésére egyedi árazás vonatkozik. Kollégánk hamarosan felveszi Önnel a kapcsolatot.'
        );
    });
});

// ─────────────────────────────────────────────────────────────
// Robusztusság — a motor soha ne adjon NaN-t vagy Infinity-t
// ─────────────────────────────────────────────────────────────

describe('robusztusság', () => {
    const rosszTeruletek = [null, 0, -5, 1.5, NaN, Infinity, -Infinity];

    for (const terulet of rosszTeruletek) {
        it(`${String(terulet)} terület → hiányos, nem egyedi árazás és nem NaN`, () => {
            const t = tetel('futesi_terv', terulet as number | null);
            expect(t.status).toBe('INCOMPLETE');
            expect(t.osszeg).toBeNull();
            expect(t.uzenet).toBeNull();
        });
    }

    it('a hiányzó terület nem számít egyedi árazásnak', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv'] }));
        expect(e.vanEgyediArazas).toBe(false);
        expect(e.figyelmeztetesek).toHaveLength(0);
    });

    it('a sávhatár feletti terület viszont igen', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 250 }));
        expect(e.vanEgyediArazas).toBe(true);
        expect(e.tetelek[0].status).toBe('CUSTOM_QUOTE');
    });

    it('üres kiválasztás esetén minden összeg nulla, nincs hibás érték', () => {
        const e = calculateQuote(bemenet());
        expect(e.tetelek).toHaveLength(0);
        expect(e.reszosszeg).toBe(0);
        expect(e.vegosszeg).toBe(0);
        expect(e.vanEgyediArazas).toBe(false);
    });

    it('ismeretlen szolgáltatáskód nem kerül be és nem okoz hibát', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['nem_letezik', 'klimaterv'] }));
        expect(e.tetelek).toHaveLength(1);
        expect(e.vegosszeg).toBe(50_000);
    });

    it('minden összeg egész forint', () => {
        const e = calculateQuote(
            bemenet({
                szolgaltatasok: ['futesi_terv', 'ontozorendszer', 'kert_koncepcio'],
                epuletTerulet: 153,
                ontozendoTerulet: 367,
                telekMeret: 850,
                hotermelok: ['hoszivattyu'],
                nincsHutes: true
            })
        );
        for (const t of e.tetelek) {
            if (t.osszeg !== null) expect(Number.isInteger(t.osszeg)).toBe(true);
        }
        expect(Number.isInteger(e.reszosszeg)).toBe(true);
        expect(Number.isInteger(e.vegosszeg)).toBe(true);
        expect(Number.isInteger(e.kedvezmeny?.osszeg)).toBe(true);
    });

    it('a kiválasztás sorrendje nem befolyásolja az eredményt', () => {
        const a = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv', 'muszaki_leiras'], epuletTerulet: 100 }));
        const b = calculateQuote(bemenet({ szolgaltatasok: ['muszaki_leiras', 'klimaterv'], epuletTerulet: 100 }));
        expect(a.tetelek.map((t) => t.kod)).toEqual(b.tetelek.map((t) => t.kod));
        expect(a.vegosszeg).toBe(b.vegosszeg);
    });

    it('az árlista verziója minden eredményben szerepel', () => {
        expect(calculateQuote(bemenet()).arlistaVerzio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('lakóépület 200 m² feletti alapterület — egyedi árazás', () => {
    it('200 m² feletti lakóépület fix szolgáltatással is egyedi, nincs végösszeg', () => {
        const e = calculateQuote(bemenet({ ingatlanJelleg: 'lakoepulet', szolgaltatasok: ['klimaterv'], epuletTerulet: 201 }));
        expect(e.vanEgyediArazas).toBe(true);
        expect(e.vegosszeg).toBeNull();
    });

    it('pontosan 200 m² lakóépület még árazott', () => {
        const e = calculateQuote(bemenet({ ingatlanJelleg: 'lakoepulet', szolgaltatasok: ['klimaterv'], epuletTerulet: 200 }));
        expect(e.vanEgyediArazas).toBe(false);
        expect(e.vegosszeg).toBe(50_000);
    });

    it('200 m² feletti nem-lakóépület nem lesz emiatt egyedi', () => {
        const e = calculateQuote(bemenet({ ingatlanJelleg: 'ipari', szolgaltatasok: ['klimaterv'], epuletTerulet: 300 }));
        expect(e.vanEgyediArazas).toBe(false);
        expect(e.vegosszeg).toBe(50_000);
    });

    it('ingatlanJelleg nélkül (régi hívók) a küszöb nem aktiválódik', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv'], epuletTerulet: 300 }));
        expect(e.vanEgyediArazas).toBe(false);
    });
});
