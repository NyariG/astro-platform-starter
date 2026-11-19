import { describe, expect, it } from 'vitest';
import { arajanlat, kiszallasDij, telepulesKeres } from './arazas';
import { tanusitvanyKeresSema } from './schema';
import { adminLevel, telegramUzenet, ugyfelLevel } from './uzenetek';

const ervenyes = {
    tipus: 'haz-egyszintes',
    nagy: false,
    telepules: 'Pannonhalma',
    nev: 'Teszt Elek',
    telefon: '+36 30 123 4567',
    email: 'teszt@example.com',
    mikor: 'jövő héten',
    adatkezeles: true,
    weboldal: ''
};

describe('kiszallasDij', () => {
    it('15 km-ig ingyenes', () => {
        expect(kiszallasDij(0)).toBe(0);
        expect(kiszallasDij(15)).toBe(0);
    });

    it('minden megkezdett 5 km 2000 Ft', () => {
        expect(kiszallasDij(15.1)).toBe(2000);
        expect(kiszallasDij(20)).toBe(2000);
        expect(kiszallasDij(20.1)).toBe(4000);
        expect(kiszallasDij(27)).toBe(6000);
    });
});

describe('telepulesKeres', () => {
    it('kis- és nagybetűtől, szóköztől függetlenül talál', () => {
        expect(telepulesKeres('  győr ')?.nev).toBe('Győr');
        expect(telepulesKeres('Abda')?.km).toBe(0);
    });

    it('ismeretlen településre null', () => {
        expect(telepulesKeres('Nincsilyenfalva')).toBeNull();
    });
});

describe('arajanlat', () => {
    it('Győr a 15 km-es körön belül van, csak az alapdíj fizetendő', () => {
        const ar = arajanlat('lakas', 'Győr', false);
        expect(ar.kiszallas).toBe(0);
        expect(ar.vegosszeg).toBe(30000);
    });

    it('távolabbi településnél hozzáadja a kiszállást', () => {
        const ar = arajanlat('haz-tobbszintes', 'Pannonhalma', false);
        expect(ar.km).toBeGreaterThan(15);
        expect(ar.vegosszeg).toBe(42000 + kiszallasDij(ar.km!));
    });

    it('nagy alapterületnél és ismeretlen településnél egyedi ár', () => {
        expect(arajanlat('lakas', 'Győr', true).vegosszeg).toBeNull();
        const ismeretlen = arajanlat('lakas', 'Nincsilyenfalva', false);
        expect(ismeretlen.telepulesIsmert).toBe(false);
        expect(ismeretlen.vegosszeg).toBeNull();
    });
});

describe('tanusitvanyKeresSema', () => {
    it('elfogadja az érvényes kérést', () => {
        expect(tanusitvanyKeresSema.safeParse(ervenyes).success).toBe(true);
    });

    it('elutasítja a hiányzó hozzájárulást, rossz telefont és e-mailt', () => {
        const eredmeny = tanusitvanyKeresSema.safeParse({ ...ervenyes, adatkezeles: false, telefon: 'abc', email: 'nem-email' });
        expect(eredmeny.success).toBe(false);
        const mezok = eredmeny.success ? [] : eredmeny.error.issues.map((i) => i.path[0]);
        expect(mezok).toEqual(expect.arrayContaining(['adatkezeles', 'telefon', 'email']));
    });

    it('a kitöltött csapdamező hibát ad', () => {
        expect(tanusitvanyKeresSema.safeParse({ ...ervenyes, weboldal: 'http://spam' }).success).toBe(false);
    });

    it('ismeretlen épülettípust elutasít', () => {
        expect(tanusitvanyKeresSema.safeParse({ ...ervenyes, tipus: 'kastely' }).success).toBe(false);
    });
});

describe('üzenetek', () => {
    const keres = tanusitvanyKeresSema.parse({ ...ervenyes, nev: 'Teszt <b>Elek</b>' });
    const ar = arajanlat(keres.tipus, keres.telepules, keres.nagy);

    it('a HTML-t escape-eli a Telegramban és a levélben', () => {
        expect(telegramUzenet(keres, ar)).toContain('Teszt &lt;b&gt;Elek&lt;/b&gt;');
        expect(adminLevel(keres, ar).html).not.toContain('<b>Elek</b>');
    });

    it('a levelekben szerepel a végösszeg és a telefonszám', () => {
        const osszeg = new Intl.NumberFormat('hu-HU').format(ar.vegosszeg!);
        expect(adminLevel(keres, ar).text).toContain(osszeg);
        expect(adminLevel(keres, ar).text).toContain('+36 30 123 4567');
        expect(ugyfelLevel(keres, ar).text).toContain(osszeg);
    });

    it('egyedi árnál nem ír összeget az ügyfélnek', () => {
        const egyedi = arajanlat('lakas', 'Győr', true);
        expect(ugyfelLevel(keres, egyedi).text).toContain('egyedileg');
    });
});
