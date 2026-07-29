import { describe, expect, it } from 'vitest';
import { arSzoveg, datumMagyar, ezresPont, fixArSzoveg, ingatlanJellegSzoveg, negyzetmeterErtek, szintekSzoveg } from './format';
import type { Tetel } from '../pricing';

function tetel(felulir: Partial<Tetel>): Tetel {
    return {
        kod: 'x',
        megnevezes: 'X',
        terulet: null,
        savLabel: null,
        egysegar: null,
        mennyiseg: 1,
        alapAr: null,
        teruletiSzorzo: null,
        osszeg: null,
        status: 'PRICED',
        uzenet: null,
        ...felulir
    };
}

describe('ezresPont', () => {
    it('ponttal tagol ezresével', () => {
        expect(ezresPont(0)).toBe('0');
        expect(ezresPont(999)).toBe('999');
        expect(ezresPont(1000)).toBe('1.000');
        expect(ezresPont(120000)).toBe('120.000');
        expect(ezresPont(1234567)).toBe('1.234.567');
    });

    it('kerekít a legközelebbi egészre', () => {
        expect(ezresPont(1000.4)).toBe('1.000');
        expect(ezresPont(1000.5)).toBe('1.001');
    });
});

describe('negyzetmeterErtek — mértékegység nélkül', () => {
    it('csak a tagolt számot adja', () => {
        expect(negyzetmeterErtek(145)).toBe('145');
        expect(negyzetmeterErtek(1200)).toBe('1.200');
    });
});

describe('arSzoveg', () => {
    it('árazott tételnél tagolt összeg + „,- Ft"', () => {
        expect(arSzoveg(tetel({ status: 'PRICED', osszeg: 230000 }))).toBe('230.000,- Ft');
    });

    it('egyedi árazású tételnél a rögzített szöveg (nincs „,- Ft")', () => {
        expect(arSzoveg(tetel({ status: 'CUSTOM_QUOTE', osszeg: null }))).toBe('egyedi árajánlat szerint');
    });

    it('még nem számolható tételnél is a rögzített szöveg', () => {
        expect(arSzoveg(tetel({ status: 'INCOMPLETE', osszeg: null }))).toBe('egyedi árajánlat szerint');
    });
});

describe('fixArSzoveg', () => {
    it('egész összeget formáz „,- Ft"-tal', () => {
        expect(fixArSzoveg(60000)).toBe('60.000,- Ft');
    });
});

describe('szintekSzoveg — igazságtábla', () => {
    const esetek: [number | null, boolean | null, string][] = [
        [1, null, 'földszintes'],
        [1, false, 'földszintes'],
        [1, true, 'földszintes, pincével'],
        [2, null, 'kétszintes'],
        [2, true, 'kétszintes, pincével'],
        [3, null, 'háromszintes'],
        [10, null, 'tízszintes'],
        [11, null, '11 szintes'],
        [null, true, 'pincével rendelkező'],
        [null, false, 'épület'],
        [null, null, 'épület']
    ];

    for (const [szint, pince, vart] of esetek) {
        it(`(${szint}, ${pince}) → „${vart}"`, () => {
            expect(szintekSzoveg(szint, pince)).toBe(vart);
        });
    }
});

describe('ingatlanJellegSzoveg — kisbetűs, mondatba illeszthető', () => {
    it('a lakóépület címkéjét kisbetűsíti', () => {
        expect(ingatlanJellegSzoveg('lakoepulet')).toBe('lakóépület');
    });
});

describe('datumMagyar — hosszú magyar dátum, budapesti idő', () => {
    it('a hónapot névvel írja', () => {
        expect(datumMagyar('2026-07-25T10:00:00.000Z')).toBe('2026. július 25.');
    });

    it('éjfél körül a budapesti naptári napot adja', () => {

        expect(datumMagyar('2026-07-24T23:30:00.000Z')).toBe('2026. július 25.');
    });
});
