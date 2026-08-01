import { describe, expect, it } from 'vitest';
import { alkalmazArCel, alkalmazSzovegMezo, alkalmazTetelNev, idopontRovid, listaBont, napFormat } from './telegram-menu';
import { SEED_ARAK, SEED_SZOVEGEK } from './admin-config';

describe('idopontRovid — dátum + óra:perc, Europe/Budapest', () => {
    it('tömör ÉÉÉÉ.HH.NN. ÓÓ:PP formátum, nyári idő (UTC+2)', () => {
        expect(idopontRovid('2026-07-31T12:05:00.000Z')).toBe('2026.07.31. 14:05');
    });

    it('téli idő (UTC+1)', () => {
        expect(idopontRovid('2026-01-15T12:05:00.000Z')).toBe('2026.01.15. 13:05');
    });

    it('éjfél körüli napváltás budapesti idő szerint', () => {
        expect(idopontRovid('2026-07-31T22:30:00.000Z')).toBe('2026.08.01. 00:30');
    });

    it('érvénytelen időpont → —', () => {
        expect(idopontRovid('nem-datum')).toBe('—');
    });
});

describe('napFormat — dátum-csoport fejléc', () => {
    it('ÉÉÉÉ-HH-NN → ÉÉÉÉ.HH.NN.', () => {
        expect(napFormat('2026-07-31')).toBe('2026.07.31.');
    });
});

describe('alkalmazArCel — minden ártípus szerkeszthető', () => {
    it('fix díj módosítása', () => {
        const uj = alkalmazArCel(SEED_ARAK, 'fix', 'muszaki_leiras', 0, 70000);
        const sz = uj.szolgaltatasok.find((s) => s.kod === 'muszaki_leiras');
        if (!sz || sz.arazas.tipus !== 'fix') throw new Error('fix tétel várt');
        expect(sz.arazas.ar).toBe(70000);
    });

    it('sávos ár csak a megadott sávban változik', () => {
        const uj = alkalmazArCel(SEED_ARAK, 'sav', 'futesi_terv', 1, 999000);
        const sz = uj.szolgaltatasok.find((s) => s.kod === 'futesi_terv');
        if (!sz || sz.arazas.tipus !== 'sav') throw new Error('sávos tétel várt');
        expect(sz.arazas.savok[1].ar).toBe(999000);
        expect(sz.arazas.savok[0].ar).toBe(200000);
        expect(sz.arazas.savok[1].max).toBe(153);
    });

    it('egységár és minimumdíj módosítása', () => {
        const a1 = alkalmazArCel(SEED_ARAK, 'egyseg', 'ontozorendszer', 0, 150);
        const a2 = alkalmazArCel(a1, 'min', 'ontozorendszer', 0, 50000);
        const sz = a2.szolgaltatasok.find((s) => s.kod === 'ontozorendszer');
        if (!sz || sz.arazas.tipus !== 'egysegar') throw new Error('egységáras tétel várt');
        expect(sz.arazas.egysegar).toBe(150);
        expect(sz.arazas.minimumDij).toBe(50000);
    });

    it('globális díjak (felár, energetika, kedvezmény)', () => {
        expect(alkalmazArCel(SEED_ARAK, 'felar', '', 0, 40000).hotermeloFelar).toBe(40000);
        expect(alkalmazArCel(SEED_ARAK, 'energetika', '', 0, 35000).energetikaiDij).toBe(35000);
        expect(alkalmazArCel(SEED_ARAK, 'kedvezmeny', '', 0, 8).kedvezmenySzazalek).toBe(8);
    });

    it('nem mutálja az eredeti configot', () => {
        const elotte = SEED_ARAK.hotermeloFelar;
        alkalmazArCel(SEED_ARAK, 'felar', '', 0, 123456);
        expect(SEED_ARAK.hotermeloFelar).toBe(elotte);
    });
});

describe('alkalmazTetelNev — tételnév átírása', () => {
    it('átírja a megnevezést', () => {
        const uj = alkalmazTetelNev(SEED_ARAK, 'klimaterv', 'Klímatervezés (bővített)');
        const sz = uj.szolgaltatasok.find((s) => s.kod === 'klimaterv');
        expect(sz?.megnevezes).toBe('Klímatervezés (bővített)');
    });
});

describe('alkalmazSzovegMezo — PDF-szövegek szerkesztése', () => {
    it('egysoros mező', () => {
        const uj = alkalmazSzovegMezo(SEED_SZOVEGEK, 'ervenyesseg', 'Az árajánlat 6 hónapig érvényes.');
        expect(uj.pdf.ervenyesseg).toBe('Az árajánlat 6 hónapig érvényes.');
    });

    it('lista mező', () => {
        const uj = alkalmazSzovegMezo(SEED_SZOVEGEK, 'tartalmazza', ['első elem', 'második elem']);
        expect(uj.pdf.tartalmazza).toEqual(['első elem', 'második elem']);
    });

    it('felső szintű mező (nem pdf alatt)', () => {
        const uj = alkalmazSzovegMezo(SEED_SZOVEGEK, 'muszakiNev', 'Új műszaki név');
        expect(uj.muszakiNev).toBe('Új műszaki név');
    });
});

describe('listaBont — soronkénti listakészítés', () => {
    it('soronként bont, trimmel, üres sort kihagy', () => {
        expect(listaBont(' alma \n\n körte \nszilva')).toEqual(['alma', 'körte', 'szilva']);
    });

    it('üres bemenet → üres lista', () => {
        expect(listaBont('   \n  ')).toEqual([]);
    });

    it('levágja a vezető felsorolásjelet (visszamásolt lista)', () => {
        expect(listaBont('• alma\n• körte\n- szilva')).toEqual(['alma', 'körte', 'szilva']);
    });
});
