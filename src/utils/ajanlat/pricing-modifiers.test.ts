import { describe, expect, it } from 'vitest';
import { alkalmazModosito, modositoHiba, modositoLeiras, type AreaModifier } from './pricing-modifiers';

describe('alkalmazModosito — a négy formátum', () => {
    it('előjeles százalék: +15% egész forintra', () => {
        expect(alkalmazModosito(12_000, { tipus: 'szazalek', ertek: 15 })).toBe(13_800);
    });

    it('előjeles százalék: −10% egész forintra', () => {
        expect(alkalmazModosito(12_000, { tipus: 'szazalek', ertek: -10 })).toBe(10_800);
    });

    it('tört: 3/4 = ×0,75', () => {
        expect(alkalmazModosito(12_000, { tipus: 'tort', szamlalo: 3, nevezo: 4 })).toBe(9_000);
    });

    it('tört: 5/4 = ×1,25', () => {
        expect(alkalmazModosito(12_000, { tipus: 'tort', szamlalo: 5, nevezo: 4 })).toBe(15_000);
    });

    it('tizedes szorzó: 1.15', () => {
        expect(alkalmazModosito(12_000, { tipus: 'tizedes', ertek: '1.15' })).toBe(13_800);
    });

    it('fix eltolás: +2000 Ft hozzáadás', () => {
        expect(alkalmazModosito(12_000, { tipus: 'fix', ertek: 2_000 })).toBe(14_000);
    });

    it('fix eltolás: negatív érték kivonás', () => {
        expect(alkalmazModosito(12_000, { tipus: 'fix', ertek: -2_000 })).toBe(10_000);
    });

    it('identitás (×1) nem változtat', () => {
        expect(alkalmazModosito(12_345, { tipus: 'tizedes', ertek: '1' })).toBe(12_345);
        expect(alkalmazModosito(12_345, { tipus: 'szazalek', ertek: 0 })).toBe(12_345);
    });
});

describe('alkalmazModosito — kerekítés és determinisztikusság', () => {
    it('mindig egész forintot ad', () => {
        const eredmeny = alkalmazModosito(40_003, { tipus: 'szazalek', ertek: 15 });
        expect(Number.isInteger(eredmeny)).toBe(true);
    });

    it('nem keletkezik lebegőpontos hiba (egész aritmetika)', () => {

        let ar = 100_000;
        for (let i = 0; i < 3; i++) ar = alkalmazModosito(ar, { tipus: 'tizedes', ertek: '1.1' });
        expect(ar).toBe(133_100);
    });

    it('1000 elemű halmozásnál nincs 1 Ft-os elcsúszás', () => {

        const egy = alkalmazModosito(12_345, { tipus: 'szazalek', ertek: 15 });
        let osszeg = 0;
        for (let i = 0; i < 1000; i++) osszeg += alkalmazModosito(12_345, { tipus: 'szazalek', ertek: 15 });
        expect(osszeg).toBe(egy * 1000);
    });
});

describe('modositoHiba — §8.2 határesetek', () => {
    it('5/0 nevező nulla → hiba, nem crash', () => {
        expect(modositoHiba({ tipus: 'tort', szamlalo: 5, nevezo: 0 })).toBe('A nevező nem lehet nulla.');
    });

    it('0/5 számláló nulla → a szorzó 0, a clamp alá esik → hiba', () => {
        expect(modositoHiba({ tipus: 'tort', szamlalo: 0, nevezo: 5 })).toContain('0.1 és 5 között');
    });

    it('negatív szorzó → hiba', () => {
        expect(modositoHiba({ tipus: 'tort', szamlalo: -1, nevezo: 4 })).toContain('0.1 és 5 között');
        expect(modositoHiba({ tipus: 'szazalek', ertek: -150 })).toContain('0.1 és 5 között');
    });

    it('extrém alsó szorzó (0,001) → elutasítva', () => {
        expect(modositoHiba({ tipus: 'tizedes', ertek: '0.001' })).toContain('0.1 és 5 között');
    });

    it('extrém felső szorzó (1000) → elutasítva', () => {
        expect(modositoHiba({ tipus: 'tizedes', ertek: '1000' })).toContain('0.1 és 5 között');
    });

    it('a tartomány szélei érvényesek', () => {
        expect(modositoHiba({ tipus: 'tizedes', ertek: '0.1' })).toBeNull();
        expect(modositoHiba({ tipus: 'tizedes', ertek: '5' })).toBeNull();
    });

    it('nem egész tört számláló/nevező → hiba', () => {
        expect(modositoHiba({ tipus: 'tort', szamlalo: 1.5, nevezo: 4 })).toContain('egész');
    });

    it('érvénytelen tizedes alak → hiba', () => {
        expect(modositoHiba({ tipus: 'tizedes', ertek: '1,15' })).toBe('Érvénytelen tizedes szorzó.');
        expect(modositoHiba({ tipus: 'tizedes', ertek: 'abc' })).toBe('Érvénytelen tizedes szorzó.');
    });

    it('nem egész fix eltolás → hiba', () => {
        expect(modositoHiba({ tipus: 'fix', ertek: 20.5 })).toContain('egész forint');
    });

    it('érvényes módosítók → nincs hiba', () => {
        const jok: AreaModifier[] = [
            { tipus: 'szazalek', ertek: 15 },
            { tipus: 'tort', szamlalo: 3, nevezo: 4 },
            { tipus: 'tizedes', ertek: '1.15' },
            { tipus: 'fix', ertek: 2_000 }
        ];
        for (const mod of jok) expect(modositoHiba(mod)).toBeNull();
    });
});

describe('alkalmazModosito — hibás módosítóra az eredeti ár marad', () => {
    it('nulla nevező esetén nem ad NaN-t', () => {
        expect(alkalmazModosito(12_000, { tipus: 'tort', szamlalo: 5, nevezo: 0 })).toBe(12_000);
    });

    it('clamp-en kívüli szorzóra nem számol', () => {
        expect(alkalmazModosito(12_000, { tipus: 'tizedes', ertek: '1000' })).toBe(12_000);
    });
});

describe('modositoLeiras — olvasható alak', () => {
    it('+15% szorzó', () => {
        expect(modositoLeiras({ tipus: 'szazalek', ertek: 15 })).toContain('+15%');
    });

    it('−25% szorzó törtből', () => {
        expect(modositoLeiras({ tipus: 'tort', szamlalo: 3, nevezo: 4 })).toContain('−25%');
    });

    it('fix eltolás forintban', () => {
        expect(modositoLeiras({ tipus: 'fix', ertek: 2_000 })).toContain('Ft');
    });

    it('identitás jelzi, hogy nincs változás', () => {
        expect(modositoLeiras({ tipus: 'tizedes', ertek: '1' })).toContain('nincs változás');
    });
});
