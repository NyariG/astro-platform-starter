import { describe, expect, it } from 'vitest';
import { ujAjanlatUzenet } from './telegram-uzenet';
import type { QuoteRecord } from './store';

function rekord(felulir: Partial<QuoteRecord> = {}): QuoteRecord {
    return {
        id: 'a1b2c3d4-0000-4000-8000-000000000001',
        nev: 'Kováts Örzsébet',
        email: 'kovats@example.com',
        telefon: '+36 30 111 2222',
        varos: 'Győr',
        ingatlanJelleg: 'lakoepulet',
        tetelek: [
            { kod: 'muszaki_leiras', megnevezes: 'Műszaki leírás egyszerű bejelentéshez', osszeg: 60000, status: 'PRICED' },
            { kod: 'futesi_terv', megnevezes: 'Fűtési terv', osszeg: 290000, status: 'PRICED' },
            { kod: 'hotermelo_felar', megnevezes: 'Hőtermelő felár (2 db)', osszeg: 60000, status: 'PRICED' },
            { kod: 'klimaterv', megnevezes: 'Klímaterv', osszeg: 50000, status: 'PRICED' }
        ],
        kedvezmeny: null,
        reszosszeg: 460000,
        vegosszeg: 460000,
        vanEgyediArazas: false,
        createdAt: '2026-07-31T06:15:00.000Z',
        ...felulir
    } as unknown as QuoteRecord;
}

describe('ujAjanlatUzenet', () => {
    it('teljes árazott ajánlat: fejléc, tételek pontos árral, összegzés, lábléc', () => {
        const { szoveg } = ujAjanlatUzenet(rekord());
        expect(szoveg).toContain('Nyári Terv · Új árajánlatkérés');
        expect(szoveg).toContain('Kováts Örzsébet');
        expect(szoveg).toContain('• Fűtési terv — 290.000,- Ft');
        expect(szoveg).toContain('• Hőtermelő felár (2 db) — 60.000,- Ft');
        expect(szoveg).toContain('Részösszeg — 460.000,- Ft');
        expect(szoveg).toContain('Végösszeg — 460.000,- Ft');
        expect(szoveg).toContain('<b>Fizetendő — 460.000,- Ft</b>');
        expect(szoveg).toContain('#a1b2c3d4');
    });

    it('kedvezmény esetén: kedvezmény-sor és pontos végösszeg', () => {
        const { szoveg } = ujAjanlatUzenet(
            rekord({
                kedvezmeny: { tipus: 'mennyezet_hutes', cimke: 'Kedvezmény (nem kér mennyezet hűtést): −5%', alap: 350000, szazalek: 5, osszeg: 17500, kuponKod: null },
                vegosszeg: 442500
            })
        );
        expect(szoveg).toContain('Kedvezmény (nem kér mennyezet hűtést): −5% — −17.500,- Ft');
        expect(szoveg).toContain('Végösszeg — 442.500,- Ft');
        expect(szoveg).toContain('<b>Fizetendő — 443.000,- Ft</b>');
    });

    it('a Fizetendő 1000-re felfelé kerekít, a Végösszeg pontos', () => {
        const { szoveg } = ujAjanlatUzenet(rekord({ reszosszeg: 943750, vegosszeg: 943750 }));
        expect(szoveg).toContain('Végösszeg — 943.750,- Ft');
        expect(szoveg).toContain('<b>Fizetendő — 944.000,- Ft</b>');
    });

    it('egyedi árazású tétel: nincs Fizetendő, "Egyedi felmérés után"', () => {
        const { szoveg } = ujAjanlatUzenet(
            rekord({
                tetelek: [
                    { kod: 'futesi_terv', megnevezes: 'Fűtési terv', osszeg: 290000, status: 'PRICED' },
                    { kod: 'klimaterv', megnevezes: 'Klímaterv', osszeg: null, status: 'CUSTOM_QUOTE' }
                ] as unknown as QuoteRecord['tetelek'],
                reszosszeg: 290000,
                vegosszeg: null,
                vanEgyediArazas: true
            })
        );
        expect(szoveg).toContain('• Klímaterv — egyedi árajánlat szerint');
        expect(szoveg).toContain('<b>Végösszeg — Egyedi felmérés után</b>');
        expect(szoveg).not.toContain('Fizetendő');
    });

    it('HTML-escaping az ügyfélnévben', () => {
        const { szoveg } = ujAjanlatUzenet(rekord({ nev: 'Tóth <b>&Társa</b>' }));
        expect(szoveg).toContain('Tóth &lt;b&gt;&amp;Társa&lt;/b&gt;');
        expect(szoveg).not.toContain('Tóth <b>&Társa');
    });

    it('telefon nélkül nincs telefon-szegmens', () => {
        const { szoveg } = ujAjanlatUzenet(rekord({ telefon: null }));
        expect(szoveg).not.toContain('📞');
    });

    it('baseUrl esetén PDF-gomb az ajánlat azonosítójával', () => {
        const { keyboard } = ujAjanlatUzenet(rekord(), { baseUrl: 'https://nyariterv.hu/' });
        expect(keyboard?.[0][0].url).toBe('https://nyariterv.hu/api/ajanlat-pdf?id=a1b2c3d4-0000-4000-8000-000000000001');
    });

    it('baseUrl nélkül nincs gomb', () => {
        const { keyboard } = ujAjanlatUzenet(rekord());
        expect(keyboard).toBeUndefined();
    });

    it('4096 fölött rövidül "+N további tétel"-lel, és belefér a limitbe', () => {
        const sok = Array.from({ length: 400 }, (_, i) => ({ kod: `k${i}`, megnevezes: `Nagyon hosszú tervezési szolgáltatás megnevezés sorszám ${i}`, osszeg: 123000 + i, status: 'PRICED' }));
        const { szoveg } = ujAjanlatUzenet(rekord({ tetelek: sok as unknown as QuoteRecord['tetelek'] }));
        expect(szoveg.length).toBeLessThanOrEqual(4096);
        expect(szoveg).toMatch(/\+\d+ további tétel/);
        expect(szoveg).toContain('<b>Fizetendő');
    });
});
