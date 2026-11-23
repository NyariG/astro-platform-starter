import { describe, expect, it } from 'vitest';
import { ajanl, TARTALYOK, type Tartaly } from './ajanlas';
import { elofeszites, futesMeretezes, gazNyomas, hmvMeretezes, tagulasiTenyezo, tartalyTerfogat, vegnyomasFutes } from './szamitas';

const tartaly = (adat: Partial<Tartaly>): Tartaly => ({
    id: 'x',
    marka: 'Proba',
    sorozat: 'A',
    alkalmazas: 'futes',
    terfogat: 50,
    ps: 6,
    p0Gyari: 1.5,
    tMembran: 70,
    tRendszer: 120,
    atmero: null,
    magassag: null,
    atfolyasos: null,
    magyar: 'proba',
    forras: null,
    megjegyzes: null,
    ...adat
});

const tarsashaz = { terfogat: 4300, tMin: 15, tMax: 60, magassag: 18, psv: 6, tagulas: 45.6 / 4300 };

describe('víz hőtágulása', () => {
    it('a gyártói táblázatokhoz közeli értéket ad', () => {
        expect(tagulasiTenyezo(10, 70)).toBeCloseTo(0.0225, 3);
        expect(tagulasiTenyezo(10, 100)).toBeCloseTo(0.0434, 2);
        expect(tagulasiTenyezo(15, 60)).toBeCloseTo(0.0162, 3);
    });

    it('azonos hőmérsékleten nulla', () => {
        expect(tagulasiTenyezo(20, 20)).toBe(0);
    });
});

describe('fűtési előfeszítés', () => {
    it('a legmagasabb ponton is legalább 0,5 bar marad, 0,1 bar-ra kerekítve', () => {
        expect(elofeszites(12.3)).toEqual({ p0: 1.8, raHagyas: 0.57 });
        expect(elofeszites(18)).toEqual({ p0: 2.3, raHagyas: 0.5 });
        expect(elofeszites(10)).toEqual({ p0: 1.5, raHagyas: 0.5 });
        expect(elofeszites(6)).toEqual({ p0: 1.1, raHagyas: 0.5 });
        expect(elofeszites(3)).toEqual({ p0: 0.8, raHagyas: 0.5 });
    });

    it('legalább 0,5 bar', () => {
        expect(elofeszites(0).p0).toBe(0.5);
        expect(elofeszites(1).p0).toBe(0.6);
    });

    it('a ráhagyás sosem kisebb 0,5 bar-nál', () => {
        for (let h = 0; h <= 60; h += 0.7) expect(elofeszites(h).raHagyas).toBeGreaterThanOrEqual(0.5 - 1e-9);
    });
});

describe('fűtési tágulási tartály', () => {
    it('a jegyzőkönyv képlete a mintapéldára 138,5 litert ad', () => {
        expect(tartalyTerfogat(45.6, 21.5, vegnyomasFutes(6), 2.3)).toBeCloseTo(138.53, 1);
    });

    it('a gáztörvény: hidegen az előfeszítés fölé, a végnyomásig emelkedik a nyomás', () => {
        expect(gazNyomas(2, 126.3, 21.5)).toBeCloseTo(2.615, 2);
        expect(gazNyomas(2, 126.3, 67.1)).toBeCloseTo(5.4, 1);
    });

    it('a legmelegebb állapot nyomása sosem haladja meg a végnyomást', () => {
        for (const psv of [2.5, 3, 4, 6, 10]) {
            for (const magassag of [0, 3, 5, 12, 25]) {
                for (const tMax of [40, 60, 80, 90]) {
                    const eredmeny = futesMeretezes({ terfogat: 300, tMin: 10, tMax, magassag, psv });
                    if ('hiba' in eredmeny) continue;
                    expect(eredmeny.maxNyomas).toBeLessThanOrEqual(eredmeny.vegnyomas + 0.005);
                    const melegtoltes = futesMeretezes({ terfogat: 300, tMin: 10, tMax, tTolt: tMax, magassag, psv });
                    if ('hiba' in melegtoltes) throw new Error(melegtoltes.hiba);
                    expect(melegtoltes.toltesiNyomas).toBeLessThanOrEqual(eredmeny.vegnyomas + 0.1);
                }
            }
        }
    });

    it('a méretezett tartály térfogata pontosan a képlet szerinti, és a legmelegebb vízzel töltve a végnyomás jön ki', () => {
        const eredmeny = futesMeretezes({ terfogat: 300, tMin: 10, tMax: 80, tTolt: 80, magassag: 3, psv: 2.5 });
        if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
        expect(eredmeny.p0).toBe(0.8);
        expect(eredmeny.vegnyomas).toBe(2);
        expect(eredmeny.vMin).toBeCloseTo(((eredmeny.tagulas + eredmeny.biztonsagiTerfogat) * 3) / 1.2, 1);
        expect(eredmeny.maxNyomas).toBeCloseTo(2, 2);
        expect(eredmeny.toltesiNyomas).toBe(2);
    });

    it('a nyomás a legmagasabb ponton hidegen sem lehet 0,5 bar alatt', () => {
        for (const magassag of [0, 3, 6, 12.3, 18, 30]) {
            const eredmeny = futesMeretezes({ terfogat: 400, tMin: 10, tMax: 70, magassag, psv: 6 });
            if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
            expect(eredmeny.felsoPontNyomas).toBeGreaterThanOrEqual(0.5);
        }
    });

    it('egy körös méretezés, a legmagasabb ponton is megmaradó nyomással', () => {
        const eredmeny = futesMeretezes(tarsashaz);
        if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
        expect(eredmeny.p0).toBe(2.3);
        expect(eredmeny.vegnyomas).toBe(5.4);
        expect(eredmeny.tagulas).toBe(45.6);
        expect(eredmeny.biztonsagiTerfogat).toBe(21.5);
        expect(eredmeny.vMin).toBeCloseTo(138.5, 1);
        expect(eredmeny.hidegNyomas).toBe(3);
        expect(eredmeny.toltesiNyomas).toBe(3);
        expect(eredmeny.felsoPontNyomas).toBeGreaterThanOrEqual(0.5);
        expect(eredmeny.maxNyomas).toBeCloseTo(5.4, 1);
    });

    it('a legmelegebb vízzel töltve a töltési nyomás a végnyomás', () => {
        const eredmeny = futesMeretezes({ ...tarsashaz, tTolt: 60 });
        if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
        expect(eredmeny.toltesiNyomas).toBeCloseTo(5.4, 1);
        expect(eredmeny.toltesiHomerseklet).toBe(60);
    });

    it('közbenső töltési hőmérsékletnél a hideg és a meleg nyomás között van', () => {
        const eredmeny = futesMeretezes({ ...tarsashaz, tTolt: 35 });
        if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
        expect(eredmeny.toltesiNyomas).toBeGreaterThan(eredmeny.hidegNyomas);
        expect(eredmeny.toltesiNyomas).toBeLessThan(eredmeny.maxNyomas);
    });

    it('nagyobb tartálynál kisebb a legmelegebb állapot nyomása', () => {
        const kicsi = futesMeretezes(tarsashaz);
        const nagy = futesMeretezes({ ...tarsashaz, tartaly: 200 });
        if ('hiba' in kicsi || 'hiba' in nagy) throw new Error('hiba');
        expect(nagy.maxNyomas).toBeLessThan(kicsi.maxNyomas);
        expect(nagy.tartaly).toBe(200);
    });

    it('a víz tágulását a hőmérséklettartomány adja', () => {
        const eredmeny = futesMeretezes({ terfogat: 300, tMin: 10, tMax: 60, magassag: 6, psv: 3 });
        if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
        expect(eredmeny.tagulasSzazalek).toBeCloseTo(1.68, 1);
        expect(eredmeny.tagulas).toBeCloseTo(5.04, 1);
        expect(eredmeny.p0).toBe(1.1);
        expect(eredmeny.vMin).toBeCloseTo(20.1, 1);
    });

    it('a végnyomás a szelepnyomás 90%-a, de legalább 0,5 bar-ral alatta', () => {
        expect(vegnyomasFutes(2.5)).toBe(2);
        expect(vegnyomasFutes(3)).toBe(2.5);
        expect(vegnyomasFutes(5)).toBe(4.5);
        expect(vegnyomasFutes(6)).toBeCloseTo(5.4, 6);
        expect(vegnyomasFutes(10)).toBe(9);
    });

    it('a minimális biztonsági térfogat 3 liter', () => {
        const eredmeny = futesMeretezes({ terfogat: 100, tMin: 15, tMax: 60, magassag: 6, psv: 3 });
        if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
        expect(eredmeny.biztonsagiTerfogat).toBe(3);
    });

    it('túl alacsony szelepnyomásnál hibát ad', () => {
        expect(futesMeretezes({ terfogat: 500, tMin: 15, tMax: 60, magassag: 18, psv: 2.5 }).ok).toBe(false);
    });

    it('érvénytelen hőmérsékletnél hibát ad', () => {
        expect(futesMeretezes({ terfogat: 300, tMin: 60, tMax: 10, magassag: 6, psv: 3 }).ok).toBe(false);
        expect(futesMeretezes({ terfogat: 300, tMin: 10, tMax: 60, tTolt: 70, magassag: 6, psv: 3 }).ok).toBe(false);
        expect(futesMeretezes({ terfogat: 300, tMin: 10, tMax: 60, tTolt: 5, magassag: 6, psv: 3 }).ok).toBe(false);
    });

    it('0 °C alatti és 100 °C feletti hőmérsékletnél hibát ad', () => {
        expect(futesMeretezes({ terfogat: 300, tMin: -5, tMax: 60, magassag: 6, psv: 3 }).ok).toBe(false);
        expect(futesMeretezes({ terfogat: 300, tMin: 10, tMax: 101, magassag: 6, psv: 3 }).ok).toBe(false);
        expect(futesMeretezes({ terfogat: 300, tMin: 0, tMax: 100, magassag: 6, psv: 3 }).ok).toBe(true);
        expect(hmvMeretezes({ terfogat: 150, tHideg: 10, tMax: 105, pHideg: 4, psv: 6 }).ok).toBe(false);
    });

    it('víztérfogat nélkül hibát ad', () => {
        expect(futesMeretezes({ terfogat: 0, tMin: 10, tMax: 60, magassag: 6, psv: 3 }).ok).toBe(false);
    });
});

describe('ivóvíz / HMV tágulási tartály', () => {
    it('a szakdolgozat adataira kb. 46 litert ad (Flamco-eljárás)', () => {
        const eredmeny = hmvMeretezes({ terfogat: 150, tHideg: 10, tMax: 70, pHideg: 4.5, psv: 5.5, tagulas: 0.0225 });
        if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
        expect(eredmeny.elofeszites).toBe(4.3);
        expect(eredmeny.vegnyomas).toBe(4.95);
        expect(eredmeny.vMin).toBeCloseTo(46.3, 1);
    });

    it('ivóvíznél a végnyomás a lefúvási nyomás 90%-a', () => {
        const eredmeny = hmvMeretezes({ terfogat: 150, tHideg: 10, tMax: 70, pHideg: 1, psv: 3, tagulas: 0.0225 });
        if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
        expect(eredmeny.vegnyomas).toBe(2.7);
    });

    it('a Flamco-példa kb. 9 litert ad', () => {
        const eredmeny = hmvMeretezes({ terfogat: 150, tHideg: 10, tMax: 70, pHideg: 4, psv: 8, tagulas: 0.0225 });
        if ('hiba' in eredmeny) throw new Error(eredmeny.hiba);
        expect(eredmeny.elofeszites).toBe(3.8);
        expect(eredmeny.vMin).toBeCloseTo(9, 0);
    });

    it('túl alacsony szelepnyomásnál hibát ad', () => {
        expect(hmvMeretezes({ terfogat: 150, tHideg: 10, tMax: 60, pHideg: 5, psv: 5 }).ok).toBe(false);
    });

    it('érvénytelen bemenetnél hibát ad', () => {
        expect(hmvMeretezes({ terfogat: 0, tHideg: 10, tMax: 60, pHideg: 4, psv: 6 }).ok).toBe(false);
        expect(hmvMeretezes({ terfogat: 100, tHideg: 60, tMax: 10, pHideg: 4, psv: 6 }).ok).toBe(false);
    });
});

describe('tartályajánlás', () => {
    const lista = [
        tartaly({ id: 'a', marka: 'A', terfogat: 80, ps: 6 }),
        tartaly({ id: 'b', marka: 'B', terfogat: 100, ps: 6 }),
        tartaly({ id: 'c', marka: 'C', terfogat: 140, ps: 3 }),
        tartaly({ id: 'd', marka: 'D', terfogat: 200, ps: 6, tRendszer: 90 }),
        tartaly({ id: 'e', marka: 'E', terfogat: 150, ps: 6, alkalmazas: 'ivoviz' })
    ];

    it('a legkisebb megfelelő tartályt ajánlja', () => {
        const ajanlas = ajanl({ alkalmazas: 'futes', vMin: 90, psv: 6, tMax: 60 }, lista);
        expect(ajanlas.legjobb?.id).toBe('b');
        expect(ajanlas.alternativak.map((t) => t.id)).toEqual(['d']);
    });

    it('kiszűri az alacsony nyomású tartályt', () => {
        const ajanlas = ajanl({ alkalmazas: 'futes', vMin: 120, psv: 6, tMax: 60 }, lista);
        expect(ajanlas.legjobb?.id).toBe('d');
    });

    it('kiszűri, ha a rendszerhőmérséklet magasabb a megengedettnél', () => {
        const ajanlas = ajanl({ alkalmazas: 'futes', vMin: 120, psv: 6, tMax: 95 }, lista);
        expect(ajanlas.legjobb).toBeNull();
    });

    it('nagyobb igénynél üzenetet ad', () => {
        const ajanlas = ajanl({ alkalmazas: 'futes', vMin: 500, psv: 6, tMax: 60 }, lista);
        expect(ajanlas.legjobb).toBeNull();
        expect(ajanlas.nincsTalalat).toContain('Egyetlen tartály sem elég');
    });

    it('a másik alkalmazás tartályait nem ajánlja', () => {
        const ajanlas = ajanl({ alkalmazas: 'ivoviz', vMin: 100, psv: 6, tMax: 60 }, lista);
        expect(ajanlas.legjobb?.id).toBe('e');
    });
});

describe('tartályadat', () => {
    it('minden sor kitöltött', () => {
        for (const t of TARTALYOK) {
            expect(t.terfogat).toBeGreaterThan(0);
            expect(t.ps).toBeGreaterThan(0);
            expect(t.magyar.length).toBeGreaterThan(0);
            expect(['futes', 'ivoviz']).toContain(t.alkalmazas);
        }
    });

    it('a gyári előfeszítés mindig kisebb a megengedett nyomásnál', () => {
        for (const t of TARTALYOK) {
            if (t.p0Gyari !== null) expect(t.p0Gyari).toBeLessThan(t.ps);
        }
    });
});
