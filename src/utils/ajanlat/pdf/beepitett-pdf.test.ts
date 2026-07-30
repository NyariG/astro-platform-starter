import { describe, expect, it } from 'vitest';
import { PDFDocument, PDFDict, PDFName, PDFString } from 'pdf-lib';
import { keszitsBeepitettPdf } from './beepitett-pdf';
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
        pince: true,
        alapterulet,
        telekMeret: felulir.telekMeret ?? 600,
        ontozendoTerulet: felulir.ontozendoTerulet ?? 400,
        szolgaltatasok,
        hotermelok,
        mennyezetHutes,
        hutesOpciok: [],
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

const TELJES = () =>
    rekord({
        szolgaltatasok: ['muszaki_leiras', 'futesi_terv', 'klimaterv', 'esoviz_szikkasztas', 'kert_koncepcio', 'kert_kiviteli', 'ontozorendszer'],
        hotermelok: ['hoszivattyu', 'gazkazan']
    });

describe('beépített pdf-lib generátor', () => {
    it('érvényes, nem üres PDF-et állít elő teljes kitöltésre', async () => {
        const bytes = await keszitsBeepitettPdf(TELJES());
        expect(bytes.length).toBeGreaterThan(1000);
        const fejlec = new TextDecoder().decode(bytes.slice(0, 5));
        expect(fejlec).toBe('%PDF-');
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBeGreaterThan(0);
    });

    it('ritka kitöltésre is legalább egy oldalt ad', async () => {
        const bytes = await keszitsBeepitettPdf(rekord({ szolgaltatasok: ['muszaki_leiras'], hotermelok: [] }));
        const doc = await PDFDocument.load(bytes);
        expect(doc.getPageCount()).toBeGreaterThan(0);
    });

    it('a magyar ékezetes ügyfélnevet is elfogadja', async () => {
        const bytes = await keszitsBeepitettPdf(rekord({ nev: 'Tóth Örzsébet Űr' }));
        const fejlec = new TextDecoder().decode(bytes.slice(0, 5));
        expect(fejlec).toBe('%PDF-');
    });

    it('a footer minden oldalra kattintható linket ágyaz be (mailto + https)', async () => {
        const bytes = await keszitsBeepitettPdf(TELJES());
        const doc = await PDFDocument.load(bytes);
        for (const oldal of doc.getPages()) {
            const annots = oldal.node.Annots();
            expect(annots).toBeTruthy();
            const uris: string[] = [];
            for (let k = 0; k < annots!.size(); k++) {
                const action = annots!.lookup(k, PDFDict).lookupMaybe(PDFName.of('A'), PDFDict);
                const uri = action?.get(PDFName.of('URI'));
                if (uri instanceof PDFString) uris.push(uri.asString());
            }
            expect(uris).toContain('mailto:info@nyariterv.hu');
            expect(uris).toContain('https://nyariterv.hu');
        }
    });
});
