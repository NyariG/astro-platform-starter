import { describe, expect, it } from 'vitest';
import { buildTemplateData } from './adatszerzodes';
import { ezresPont, fixArSzoveg } from './format';
import { ENERGETIKAI_TANUSITVANY_DIJ } from '../pricing-config';
import type { QuoteRecord } from '../store';
import { calculateQuote } from '../pricing';

function rekord(felulir: Partial<QuoteRecord> = {}): QuoteRecord {
    const szolgaltatasok = felulir.szolgaltatasok ?? ['muszaki_leiras', 'futesi_terv', 'klimaterv'];
    const hotermelok = felulir.hotermelok ?? ['hoszivattyu'];
    const alapterulet = felulir.alapterulet !== undefined ? felulir.alapterulet : 120;
    const mennyezetHutes = felulir.mennyezetHutes ?? 'igen';

    const arazas = calculateQuote({
        szolgaltatasok,
        epuletTerulet: alapterulet,
        telekMeret: felulir.telekMeret ?? 600,
        ontozendoTerulet: felulir.ontozendoTerulet ?? 400,
        hotermelok,
        nincsHutes: mennyezetHutes === 'nem'
    });

    return {
        id: 'e1f9b0a2-0000-4000-8000-000000000001',
        nev: 'Kovács Anna',
        email: 'a@example.com',
        emailNormalized: 'a@example.com',
        telefon: null,
        varos: 'Győr',
        ingatlanJelleg: 'lakoepulet',
        tervCelja: 'uj_epites',
        szintek: 2,
        pince: null,
        alapterulet,
        telekMeret: felulir.telekMeret ?? 600,
        ontozendoTerulet: felulir.ontozendoTerulet ?? 400,
        szolgaltatasok,
        hotermelok,
        mennyezetHutes,

        hutesOpciok: [],
        egyediLeiras: null,
        softLock: false,
        kuponKod: null,
        jogiNyilatkozatVerzio: '1.0',
        tetelek: arazas.tetelek,
        kedvezmeny: arazas.kedvezmeny,
        reszosszeg: arazas.reszosszeg,
        vegosszeg: arazas.vegosszeg,
        vanEgyediArazas: arazas.vanEgyediArazas,
        arlistaVerzio: arazas.arlistaVerzio,
        gdprConsent: true,
        status: 'new',
        attemptNumber: 1,
        ip: '1.2.3.4',
        userAgent: 't',
        sourceUrl: 'https://nyariterv.hu/ajanlat',
        createdAt: '2026-07-25T08:30:00.000Z',
        emailSentAt: null,
        emailError: null,
        ...felulir
    };
}

describe('skalár mezők', () => {
    it('a nevet, dátumot, jelleget és területet a rekordból veszi', () => {
        const adat = buildTemplateData(rekord());
        expect(adat.UGYFELNEV).toBe('Kovács Anna');
        expect(adat.AKTUALIS_DATUM).toBe('2026. július 25.');
        expect(adat.INGATLAN_JELLEGE).toBe('lakóépület');
        expect(adat.NEGYZETMETER_ERTEK).toBe('120');
        expect(adat.SZINTEK_SZAMA).toBe('kétszintes');
    });

    it('a szintszöveg a pincét is tükrözi', () => {
        expect(buildTemplateData(rekord({ szintek: 1, pince: true })).SZINTEK_SZAMA).toBe('földszintes, pincével');
    });

    it('hiányzó alapterületnél gondolatjel', () => {
        expect(buildTemplateData(rekord({ alapterulet: null, szolgaltatasok: ['kert_koncepcio'], hotermelok: [] })).NEGYZETMETER_ERTEK).toBe('—');
    });
});

describe('műszaki leírás — név, ár, részletező szöveg, feltételes', () => {
    it('kiválasztva: muszakiVan true, név + ár + tartalmazza-szöveg', () => {
        const adat = buildTemplateData(rekord({ szolgaltatasok: ['muszaki_leiras'], hotermelok: [] }));
        expect(adat.muszakiVan).toBe(true);
        expect(adat.MUSZAKI_LEIRAS).toBe('Műszaki leírás egyszerű bejelentéshez');
        expect(adat.MUSZAKI_LEIRAS_ARA).toBe('60.000');
        expect(adat.RESZLETEZO_SZOVEG).toContain('Tartalmazza');
    });

    it('nélküle: muszakiVan false, üres név és szöveg', () => {
        const adat = buildTemplateData(rekord({ szolgaltatasok: ['klimaterv'], hotermelok: [] }));
        expect(adat.muszakiVan).toBe(false);
        expect(adat.MUSZAKI_LEIRAS).toBe('');
        expect(adat.RESZLETEZO_SZOVEG).toBe('');
    });
});

describe('RESZLETEK táblázat-sorok', () => {
    it('az Áttekintés adatait sorokra bontja, csak a kitöltötteket', () => {
        const adat = buildTemplateData(rekord({ szolgaltatasok: ['muszaki_leiras', 'futesi_terv'], hotermelok: ['gazkazan'], szintek: 2, pince: true, alapterulet: 120 }));
        const parok = Object.fromEntries(adat.reszletek.map((s) => [s.cimke, s.ertek]));
        expect(parok['Ingatlan jellege']).toBe('Lakóépület');
        expect(parok['Terv célja']).toBe('Új építés');
        expect(parok['Szintek száma']).toBe('2');
        expect(parok['Pince']).toBe('Van');
        expect(parok['Kért szolgáltatások']).toContain('Fűtési terv');
        expect(parok['Hőtermelők']).toBe('Gázkazán');
    });

    it('a hiányzó mezők nem kerülnek be', () => {
        const adat = buildTemplateData(rekord({ szolgaltatasok: ['klimaterv'], hotermelok: [], szintek: null, pince: null }));
        const cimkek = adat.reszletek.map((s) => s.cimke);
        expect(cimkek).not.toContain('Szintek száma');
        expect(cimkek).not.toContain('Pince');
        expect(cimkek).not.toContain('Hőtermelők');
    });
});

describe('B-opció („további") blokk', () => {
    it('a hőtermelő felár a fűtési terv árába épül, külön felár-sor nélkül', () => {
        const rec = rekord({ szolgaltatasok: ['futesi_terv', 'klimaterv'], hotermelok: ['hoszivattyu', 'gazkazan'] });
        const adat = buildTemplateData(rec);
        const nevek = adat.tovabbi.map((t) => t.nev);
        expect(nevek).toContain('Fűtési terv');
        expect(nevek).toContain('Klímaterv');
        expect(nevek.some((n) => n.startsWith('Hőtermelő felár'))).toBe(false);

        const futesi = rec.tetelek.find((t) => t.kod === 'futesi_terv')!;
        const felar = rec.tetelek.find((t) => t.kod === 'hotermelo_felar')!;
        const futesiSor = adat.tovabbi.find((t) => t.nev === 'Fűtési terv')!;
        expect(futesiSor.TOVABBI_KIVITELEZESI_TERVEK_ARAI).toBe(`${ezresPont(futesi.osszeg! + felar.osszeg!)},- Ft`);
    });

    it('a tételek az ártokenük nevén hordozzák az árat', () => {
        const adat = buildTemplateData(rekord({ szolgaltatasok: ['klimaterv'], hotermelok: [] }));
        expect(adat.tovabbi[0].TOVABBI_KIVITELEZESI_TERVEK_ARAI).toBe('50.000,- Ft');
    });

    it('B-szolgáltatás nélkül a blokk üres', () => {
        const adat = buildTemplateData(rekord({ szolgaltatasok: ['muszaki_leiras'], hotermelok: [] }));
        expect(adat.tovabbi).toHaveLength(0);
    });
});

describe('egyéb és kert blokkok', () => {
    it('az esővíz és a központi porszívó az „egyéb" blokkba kerül', () => {
        const adat = buildTemplateData(rekord({ szolgaltatasok: ['esoviz_szikkasztas', 'kozponti_porszivo'], hotermelok: [] }));
        expect(adat.egyeb.map((t) => t.nev)).toEqual(['Esővíz szikkasztási terv', 'Központi porszívó terv']);
        expect(adat.egyeb[0].EGYEB_KIVITELEZESI_TERVEK_ARAI).toBe('100.000,- Ft');
    });

    it('a kert-szolgáltatások a saját blokkjukba kerülnek, kertVan igaz + fejléc-szöveg', () => {
        const adat = buildTemplateData(rekord({ szolgaltatasok: ['kert_koncepcio', 'kert_kiviteli', 'ontozorendszer'], hotermelok: [] }));
        expect(adat.kertVan).toBe(true);
        expect(adat.KERTTEL_KAPCSOLATOS_TERVEK).toBe('Kertépítészeti és öntözési tervezés (közvetített szolgáltatás):');
        expect(adat.kertKoncepcio).toHaveLength(1);
        expect(adat.kertKiviteles).toHaveLength(1);
        expect(adat.ontozo).toHaveLength(1);
        expect(adat.kertKoncepcio[0].KERT_KONCEPCIO_TERVEK_ARAI).toContain('Ft');
        expect(adat.ontozo[0].AUTOMATA_ONTOZORENDSZER_TERVEK_ARAI).toContain('Ft');
    });

    it('kert nélkül kertVan hamis, üres fejléc-szöveg', () => {
        const adat = buildTemplateData(rekord({ szolgaltatasok: ['muszaki_leiras'], hotermelok: [] }));
        expect(adat.kertVan).toBe(false);
        expect(adat.KERTTEL_KAPCSOLATOS_TERVEK).toBe('');
    });

    it('egyedi árazású tétel a rögzített szöveget kapja', () => {

        const adat = buildTemplateData(rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], alapterulet: 300 }));
        expect(adat.tovabbi[0].TOVABBI_KIVITELEZESI_TERVEK_ARAI).toBe('egyedi árajánlat szerint');
    });
});

describe('mennyezethűtés-kedvezmény a fűtési terv árában', () => {
    it('érvényesülő kedvezmény a fűtési terv árába épül, külön sor nélkül', () => {
        const rec = rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], mennyezetHutes: 'nem' });
        const adat = buildTemplateData(rec);
        expect(adat.tovabbi.some((t) => t.nev.startsWith('Kedvezmény'))).toBe(false);
        expect(adat.tovabbi.some((t) => t.nev.startsWith('Hőtermelő felár'))).toBe(false);

        const futesi = rec.tetelek.find((t) => t.kod === 'futesi_terv')!;
        const felar = rec.tetelek.find((t) => t.kod === 'hotermelo_felar')!;
        const vart = futesi.osszeg! + felar.osszeg! - rec.kedvezmeny!.osszeg;
        const futesiSor = adat.tovabbi.find((t) => t.nev === 'Fűtési terv')!;
        expect(futesiSor.TOVABBI_KIVITELEZESI_TERVEK_ARAI).toBe(`${ezresPont(vart)},- Ft`);
    });

    it('mennyezethűtést kér (igen) → a fűtési terv ára = díj + felár, levonás nélkül', () => {
        const rec = rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], mennyezetHutes: 'igen' });
        const adat = buildTemplateData(rec);
        expect(adat.tovabbi.some((t) => t.nev.startsWith('Kedvezmény'))).toBe(false);
        const futesi = rec.tetelek.find((t) => t.kod === 'futesi_terv')!;
        const felar = rec.tetelek.find((t) => t.kod === 'hotermelo_felar')!;
        const futesiSor = adat.tovabbi.find((t) => t.nev === 'Fűtési terv')!;
        expect(futesiSor.TOVABBI_KIVITELEZESI_TERVEK_ARAI).toBe(`${ezresPont(futesi.osszeg! + felar.osszeg!)},- Ft`);
    });

    it('ha kupon nyert (nem mennyezet típus), a fűtési tervbe nem épül mennyezet-levonás', () => {
        const alap = rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], mennyezetHutes: 'nem' });
        const kuponosRekord = {
            ...alap,
            kedvezmeny: { tipus: 'kupon' as const, cimke: 'Kuponkedvezmény (X): −10%', alap: 260000, szazalek: 10, osszeg: 26000, kuponKod: 'X' }
        };
        const adat = buildTemplateData(kuponosRekord);
        expect(adat.tovabbi.some((t) => t.nev.startsWith('Kedvezmény'))).toBe(false);
        const futesi = alap.tetelek.find((t) => t.kod === 'futesi_terv')!;
        const felar = alap.tetelek.find((t) => t.kod === 'hotermelo_felar')!;
        const futesiSor = adat.tovabbi.find((t) => t.nev === 'Fűtési terv')!;
        expect(futesiSor.TOVABBI_KIVITELEZESI_TERVEK_ARAI).toBe(`${ezresPont(futesi.osszeg! + felar.osszeg!)},- Ft`);
    });
});

describe('összesítő blokk (kupon + két végösszeg)', () => {
    function kuponos(felulir: Partial<QuoteRecord> = {}): QuoteRecord {
        const alap = rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], mennyezetHutes: 'igen', ...felulir });
        const osszeg = Math.round(alap.reszosszeg * 0.1);
        return { ...alap, kuponKod: 'nyar10', kedvezmeny: { tipus: 'kupon', cimke: 'x', alap: alap.reszosszeg, szazalek: 10, osszeg, kuponKod: 'NYAR10' }, vegosszeg: alap.reszosszeg - osszeg };
    }

    it('kupon esetén: kuponVan, nagybetűs kód + százalék, negatív ár, két végösszeg', () => {
        const rec = kuponos();
        const adat = buildTemplateData(rec);
        expect(adat.kuponVan).toBe(true);
        expect(adat.KUPON_KEDVEZMENY).toBe('Kupon (NYAR10 – 10%)');
        expect(adat.KUPON_KEDVEZMENY_ARA).toBe(`−${ezresPont(rec.kedvezmeny!.osszeg)},- Ft`);
        expect(adat.VEGOSSZEG_ARA_ENERGETIKA_NELKUL).toBe(fixArSzoveg(rec.vegosszeg!));
        expect(adat.VEGOSSZEG_ARA_ENERGETIKAVAL).toBe(fixArSzoveg(rec.vegosszeg! + ENERGETIKAI_TANUSITVANY_DIJ));
    });

    it('kupon nélkül: nincs kupon-mező, de van két végösszeg', () => {
        const rec = rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], mennyezetHutes: 'igen' });
        const adat = buildTemplateData(rec);
        expect(adat.kuponVan).toBe(false);
        expect(adat.KUPON_KEDVEZMENY).toBe('');
        expect(adat.KUPON_KEDVEZMENY_ARA).toBe('');
        expect(adat.VEGOSSZEG_ARA_ENERGETIKA_NELKUL).toBe(fixArSzoveg(rec.vegosszeg!));
        expect(adat.VEGOSSZEG_ARA_ENERGETIKAVAL).toBe(fixArSzoveg(rec.vegosszeg! + ENERGETIKAI_TANUSITVANY_DIJ));
    });

    it('egyedi árazásnál mindkét végösszeg „egyedi árajánlat szerint"', () => {
        const rec = rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], alapterulet: 300 });
        expect(rec.vegosszeg).toBeNull();
        const adat = buildTemplateData(rec);
        expect(adat.VEGOSSZEG_ARA_ENERGETIKA_NELKUL).toBe('egyedi árajánlat szerint');
        expect(adat.VEGOSSZEG_ARA_ENERGETIKAVAL).toBe('egyedi árajánlat szerint');
    });

    it('kedvezmény > részösszeg → 0-ra vágott végösszeg', () => {
        const alap = rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'] });
        const rec: QuoteRecord = { ...alap, kedvezmeny: { tipus: 'kupon', cimke: 'x', alap: alap.reszosszeg, szazalek: 100, osszeg: alap.reszosszeg + 5000, kuponKod: 'X' }, vegosszeg: -5000 };
        const adat = buildTemplateData(rec);
        expect(adat.VEGOSSZEG_ARA_ENERGETIKA_NELKUL).toBe(fixArSzoveg(0));
        expect(adat.VEGOSSZEG_ARA_ENERGETIKAVAL).toBe(fixArSzoveg(ENERGETIKAI_TANUSITVANY_DIJ));
    });
});
