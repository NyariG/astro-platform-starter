import { describe, expect, it } from 'vitest';
import { fieldErrors, quoteInputSchema, teruletErtelmezes, teruletSzam } from './schema';

function ervenyes(felulir: Record<string, unknown> = {}) {
    return {
        nev: 'Teszt Elek',
        email: 'teszt@example.com',
        telefon: '+36 20 123 4567',
        varos: 'Győr',
        ingatlanJelleg: 'lakoepulet',
        tervCelja: 'uj_epites',
        szintek: '2',
        szolgaltatasok: ['futesi_terv'],
        alapterulet: '120',
        telekMeret: '',
        ontozendoTerulet: '',
        hotermelok: ['gazkazan'],
        mennyezetHutes: 'igen',
        gdprConsent: true,
        ...felulir
    };
}

function hibak(bemenet: Record<string, unknown>) {
    const eredmeny = quoteInputSchema.safeParse(bemenet);
    return eredmeny.success ? {} : fieldErrors(eredmeny.error);
}

describe('alapesetek', () => {
    it('elfogadja az érvényes beküldést', () => {
        expect(quoteInputSchema.safeParse(ervenyes()).success).toBe(true);
    });

    it('levágja a felesleges szóközöket', () => {
        const e = quoteInputSchema.safeParse(ervenyes({ nev: '  Teszt Elek  ', varos: ' Győr ' }));
        expect(e.success).toBe(true);
        if (e.success) {
            expect(e.data.nev).toBe('Teszt Elek');
            expect(e.data.varos).toBe('Győr');
        }
    });

    it('a telefonszám és a szintszám elhagyható', () => {
        expect(quoteInputSchema.safeParse(ervenyes({ telefon: '', szintek: '' })).success).toBe(true);
    });
});

describe('kötelező mezők', () => {
    it('hiányzó nevet elutasít', () => {
        expect(hibak(ervenyes({ nev: '' })).nev).toBe('Kérjük, adja meg a nevét.');
    });

    it('hibás e-mail címet elutasít', () => {
        expect(hibak(ervenyes({ email: 'nem-email' })).email).toBe('Adjon meg egy érvényes e-mail címet.');
    });

    it('hiányzó települést elutasít', () => {
        expect(hibak(ervenyes({ varos: '' })).varos).toBe('Kérjük, adja meg a települést.');
    });

    it('elutasítja a hozzájárulás nélküli beküldést', () => {
        expect(hibak(ervenyes({ gdprConsent: false })).gdprConsent).toBe('Az adatkezelési hozzájárulás megadása kötelező.');
    });

    it('elutasítja az üres szolgáltatáslistát', () => {
        expect(hibak(ervenyes({ szolgaltatasok: [], hotermelok: [] })).szolgaltatasok).toBe('Válasszon legalább egy szolgáltatást.');
    });
});

describe('feltételes területkötelezőség', () => {
    it('épület alapterületű szolgáltatásnál kötelező az alapterület', () => {
        expect(hibak(ervenyes({ alapterulet: '' })).alapterulet).toBe('Kérjük, adja meg az alapterületet.');
    });

    it('kertépítésnél a telekméret kötelező', () => {
        const h = hibak(ervenyes({ szolgaltatasok: ['kert_koncepcio'], hotermelok: [], alapterulet: '', telekMeret: '' }));
        expect(h.telekMeret).toBe('Kérjük, adja meg az alapterületet.');
    });

    it('öntözőrendszernél az öntözendő terület kötelező', () => {
        const h = hibak(ervenyes({ szolgaltatasok: ['ontozorendszer'], hotermelok: [], alapterulet: '', ontozendoTerulet: '' }));
        expect(h.ontozendoTerulet).toBe('Kérjük, adja meg az alapterületet.');
    });

    it('fix díjas szolgáltatásnál egyik terület sem kötelező', () => {
        const e = quoteInputSchema.safeParse(ervenyes({ szolgaltatasok: ['klimaterv'], hotermelok: [], alapterulet: '', telekMeret: '', ontozendoTerulet: '' }));
        expect(e.success).toBe(true);
    });

    it('nem kéri a telekméretet, ha nincs kertépítés', () => {
        expect(hibak(ervenyes({ telekMeret: '' })).telekMeret).toBeUndefined();
    });
});

describe('hőtermelő szabályok', () => {
    it('fűtési terv esetén kötelező a hőtermelő', () => {
        expect(hibak(ervenyes({ hotermelok: [] })).hotermelok).toBe('Fűtési terv esetén válasszon legalább egy hőtermelőt.');
    });

    it('fűtési terv nélkül nem adható meg hőtermelő', () => {
        const h = hibak(ervenyes({ szolgaltatasok: ['klimaterv'], hotermelok: ['gazkazan'], alapterulet: '' }));
        expect(h.hotermelok).toBe('Hőtermelő csak fűtési terv igénylése esetén választható.');
    });

    it('ismeretlen hőtermelőt elutasít', () => {
        expect(hibak(ervenyes({ hotermelok: ['atomreaktor'] })).hotermelok).toBeTruthy();
    });
});

describe('a klímaterv és a kedvezmény együtt is megengedett', () => {
    it('a „nem" válasz és a klímaterv egyszerre érvényes', () => {
        const e = quoteInputSchema.safeParse(ervenyes({ szolgaltatasok: ['futesi_terv', 'klimaterv'], mennyezetHutes: 'nem' }));
        expect(e.success).toBe(true);
    });

    it('a mennyezethűtés kérdés szerveroldalon opcionális (a kötelezőséget a kliens kapuzza a Hűtési terv csoportnál)', () => {

        const e = quoteInputSchema.safeParse(ervenyes({ szolgaltatasok: ['futesi_terv'], mennyezetHutes: '' }));
        expect(e.success).toBe(true);
    });

    it('fűtési terv nélkül a kérdés elhagyható', () => {
        const e = quoteInputSchema.safeParse(ervenyes({ szolgaltatasok: ['klimaterv'], hotermelok: [], alapterulet: '', mennyezetHutes: '' }));
        expect(e.success).toBe(true);
    });

    it('ismeretlen választ elutasít', () => {
        expect(hibak(ervenyes({ mennyezetHutes: 'talan' })).mennyezetHutes).toBeTruthy();
    });
});

describe('teruletErtelmezes — érvénytelen bemenetek', () => {
    const esetek: [unknown, string][] = [
        ['', 'Kérjük, adja meg az alapterületet.'],
        [' ', 'Kérjük, adja meg az alapterületet.'],
        ['0', 'Az érték legalább 1 lehet.'],
        ['-5', 'Csak egész szám adható meg.'],
        ['abc', 'Csak egész szám adható meg.'],
        ['1.5', 'Csak egész szám adható meg.'],
        ['1,5', 'Csak egész szám adható meg.'],
        ['1e5', 'Csak egész szám adható meg.'],
        ['999999999', 'Csak egész szám adható meg.'],
        ['١٢٣', 'Csak egész szám adható meg.'],
        ['12abc', 'Csak egész szám adható meg.'],
        ['999999', 'Az érték legfeljebb 100 000 lehet.']
    ];

    for (const [bemenet, vart] of esetek) {
        it(`${JSON.stringify(bemenet)} → „${vart}”`, () => {
            const eredmeny = teruletErtelmezes(bemenet as string);
            expect(eredmeny.ok).toBe(false);
            if (eredmeny.ok === false) expect(eredmeny.uzenet).toBe(vart);
        });
    }

    it('a körülvett szóközöket levágja, az értéket elfogadja', () => {
        const eredmeny = teruletErtelmezes('  12  ');
        expect(eredmeny.ok).toBe(true);
        if (eredmeny.ok) expect(eredmeny.ertek).toBe(12);
    });

    it('a vezető nullát elfogadja és számmá alakítja', () => {
        const eredmeny = teruletErtelmezes('012');
        expect(eredmeny.ok).toBe(true);
        if (eredmeny.ok) expect(eredmeny.ertek).toBe(12);
    });

    it('a határértékeket elfogadja', () => {
        expect(teruletSzam('1')).toBe(1);
        expect(teruletSzam('100000')).toBe(100_000);
        expect(teruletSzam('100001')).toBeNull();
    });
});

describe('közvetlen API-hívás — nem string típusú területérték', () => {
    const rosszTipusok = [null, [], {}, 123, true];

    for (const ertek of rosszTipusok) {
        it(`${JSON.stringify(ertek)} → magyar hibaüzenet, nem zod-alapértelmezés`, () => {
            const h = hibak(ervenyes({ alapterulet: ertek }));
            expect(h.alapterulet).toBe('Csak egész szám adható meg.');
        });
    }

    it('a szolgáltatáslista nem tömb típusa magyar üzenetet ad', () => {
        expect(hibak(ervenyes({ szolgaltatasok: 'futesi_terv' })).szolgaltatasok).toBe('Válasszon legalább egy szolgáltatást.');
    });

    it('ismeretlen szolgáltatáskódot elutasít', () => {
        expect(hibak(ervenyes({ szolgaltatasok: ['medence_terv'], hotermelok: [] })).szolgaltatasok).toBe('Ismeretlen szolgáltatás.');
    });
});

describe('pince (opcionális, tájékoztató)', () => {
    it('elfogadja a van / nincs / üres értéket', () => {
        expect(quoteInputSchema.safeParse(ervenyes({ pince: 'van' })).success).toBe(true);
        expect(quoteInputSchema.safeParse(ervenyes({ pince: 'nincs' })).success).toBe(true);
        expect(quoteInputSchema.safeParse(ervenyes({ pince: '' })).success).toBe(true);
    });

    it('a mező elhagyható (alapértéke üres)', () => {
        const e = quoteInputSchema.safeParse(ervenyes());
        expect(e.success).toBe(true);
        if (e.success) expect(e.data.pince).toBe('');
    });

    it('ismeretlen értéket elutasít', () => {
        expect(hibak(ervenyes({ pince: 'talan' })).pince).toBeTruthy();
    });
});

describe('szintek száma', () => {
    it('elfogadja az 1 és 50 közötti értéket', () => {
        expect(quoteInputSchema.safeParse(ervenyes({ szintek: '50' })).success).toBe(true);
    });

    it('elutasítja az 50 fölöttit', () => {
        expect(hibak(ervenyes({ szintek: '51' })).szintek).toBe('A szintek száma 1 és 50 között lehet.');
    });

    it('elutasítja a nem számot', () => {
        expect(hibak(ervenyes({ szintek: 'kettő' })).szintek).toBe('A szintek száma 1 és 50 között lehet.');
    });
});

describe('telefonszám', () => {
    it('a túl rövid telefonszámot elutasítja', () => {
        expect(hibak(ervenyes({ telefon: '123' })).telefon).toBe('A telefonszám formátuma nem megfelelő.');
    });

    it('elfogadja a szóközös és kötőjeles formákat', () => {
        for (const szam of ['+36 20 123 4567', '06-20-123-4567', '06201234567']) {
            expect(quoteInputSchema.safeParse(ervenyes({ telefon: szam })).success).toBe(true);
        }
    });
});

describe('fieldErrors', () => {
    it('mezőnként egyetlen üzenetet ad vissza', () => {
        const eredmeny = quoteInputSchema.safeParse(ervenyes({ nev: '', email: 'rossz', varos: '' }));
        expect(eredmeny.success).toBe(false);
        if (!eredmeny.success) {
            const mezok = fieldErrors(eredmeny.error);
            expect(Object.keys(mezok).sort()).toEqual(['email', 'nev', 'varos']);
            expect(Object.values(mezok).every((uzenet) => typeof uzenet === 'string' && uzenet.length > 0)).toBe(true);
        }
    });

    it('a honeypot mező nem kerül be az eredménybe', () => {
        const e = quoteInputSchema.safeParse({ ...ervenyes(), _cegnev: 'bot' });
        expect(e.success).toBe(true);
        if (e.success) expect('_cegnev' in e.data).toBe(false);
    });
});
