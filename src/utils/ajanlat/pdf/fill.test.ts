import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';
import { toltsdKiSablon } from './fill';
import { ezresPont } from './format';
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

function bekezdesek(bytes: Uint8Array): string[] {
    const xml = new PizZip(Buffer.from(bytes)).file('word/document.xml')!.asText();
    const body = xml.split('<w:body>')[1].split('</w:body>')[0];
    const paras = body.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
    return paras.map((p) => {
        let s = '';
        for (const r of p.match(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g) || []) {
            for (const m of r.matchAll(/<w:tab\/>|<w:t[^>]*>([\s\S]*?)<\/w:t>/g)) {
                s += m[0] === '<w:tab/>' ? '\t' : m[1];
            }
        }
        return s;
    });
}

const TOKEN = /\[(#|\/)?[A-Za-z_]+\]/;

async function sorokBol(record: QuoteRecord): Promise<string[]> {
    return bekezdesek(await toltsdKiSablon(record));
}

async function szovegBol(record: QuoteRecord): Promise<string> {
    return (await sorokBol(record)).join('\n');
}

const TELJES = () =>
    rekord({
        szolgaltatasok: ['muszaki_leiras', 'futesi_terv', 'klimaterv', 'esoviz_szikkasztas', 'kert_koncepcio', 'kert_kiviteli', 'ontozorendszer'],
        hotermelok: ['hoszivattyu', 'gazkazan']
    });

describe('teljes kitöltés — minden szekció', () => {
    it('nem marad feloldatlan token', async () => {
        expect(await szovegBol(TELJES())).not.toMatch(TOKEN);
    });

    it('kitölti az ügyfél nevét és a dátumot', async () => {
        const szoveg = await szovegBol(TELJES());
        expect(szoveg).toContain('Tisztelt Kovács Anna!');
        expect(szoveg).toContain('2026. július 25.');
    });

    it('a RESZLETEK tábla, a műszaki leírás és a kert fejléc megjelenik', async () => {
        const szoveg = await szovegBol(TELJES());
        expect(szoveg).toContain('Ingatlan jellege');
        expect(szoveg).toContain('Kért szolgáltatások');
        expect(szoveg).toContain('Műszaki leírás egyszerű bejelentéshez');
        expect(szoveg).toContain('(Tartalmazza:');
        expect(szoveg).toContain('Kertépítészeti és öntözési tervezés (közvetített szolgáltatás):');
        expect(szoveg).toContain('kizárólag a ténylegesen öntözendő felület');
    });

    it('a fűtési terv és a klímaterv külön bekezdésbe kerül', async () => {
        const sorok = await sorokBol(TELJES());
        const futes = sorok.findIndex((s) => s.includes('Fűtési terv') && s.includes('Ft'));
        const klima = sorok.findIndex((s) => s.includes('Klímaterv') && s.includes('Ft'));
        expect(futes).toBeGreaterThanOrEqual(0);
        expect(klima).toBeGreaterThanOrEqual(0);
        expect(futes).not.toBe(klima);
    });

    it('nincs kettőzött „,- Ft"', async () => {
        expect(await szovegBol(TELJES())).not.toContain(',- Ft,- Ft');
    });
});

describe('ritka kitöltés — csak műszaki leírás', () => {
    const RITKA = () => rekord({ szolgaltatasok: ['muszaki_leiras'], hotermelok: [] });

    it('nem marad feloldatlan token', async () => {
        expect(await szovegBol(RITKA())).not.toMatch(TOKEN);
    });

    it('a műszaki leírás neve és díja megjelenik', async () => {
        const szoveg = await szovegBol(RITKA());
        expect(szoveg).toContain('Műszaki leírás egyszerű bejelentéshez');
        expect(szoveg).toContain('60.000,- Ft');
    });

    it('a kert fejléc és az öntöző szekció nyomtalanul eltűnik', async () => {
        const szoveg = await szovegBol(RITKA());
        expect(szoveg).not.toContain('Kertépítészeti és öntözési tervezés');
        expect(szoveg).not.toContain('Automata öntözőrendszer');
    });

    it('az „Egyéb" szekció fix Energetikai sora megmarad', async () => {
        expect(await szovegBol(RITKA())).toContain('Energetikai tanúsítvány');
    });
});

describe('mennyezethűtés-kedvezmény és hőtermelő felár a renderelt DOCX-ben', () => {
    it('a kedvezmény és a felár a fűtési terv árába épül, külön sor nélkül', async () => {
        const rec = rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], mennyezetHutes: 'nem' });
        const szoveg = await szovegBol(rec);
        const futesi = rec.tetelek.find((t) => t.kod === 'futesi_terv')!;
        const felar = rec.tetelek.find((t) => t.kod === 'hotermelo_felar')!;
        const vart = ezresPont(futesi.osszeg! + felar.osszeg! - rec.kedvezmeny!.osszeg);
        expect(szoveg).toContain(`${vart},- Ft`);
        expect(szoveg).not.toContain('Kedvezmény – nem kér mennyezet hűtést');
        expect(szoveg).not.toContain('Hőtermelő felár');
        expect(szoveg).not.toMatch(TOKEN);
    });

    it('mennyezethűtést kér esetén sincs külön kedvezmény- vagy felár-sor', async () => {
        const rec = rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], mennyezetHutes: 'igen' });
        const szoveg = await szovegBol(rec);
        const futesi = rec.tetelek.find((t) => t.kod === 'futesi_terv')!;
        const felar = rec.tetelek.find((t) => t.kod === 'hotermelo_felar')!;
        expect(szoveg).toContain(`${ezresPont(futesi.osszeg! + felar.osszeg!)},- Ft`);
        expect(szoveg).not.toContain('Kedvezmény – nem kér mennyezet hűtést');
        expect(szoveg).not.toContain('Hőtermelő felár');
    });
});

describe('egyedi árazású tétel', () => {
    it('200 m² feletti fűtési tervnél az „egyedi árajánlat szerint" jelenik meg, „,- Ft" nélkül', async () => {
        const szoveg = await szovegBol(rekord({ szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'], alapterulet: 300 }));
        expect(szoveg).toContain('egyedi árajánlat szerint');
        expect(szoveg).not.toMatch(TOKEN);
    });
});

describe('összesítő blokk a renderelt DOCX-ben', () => {
    function kuponosRek(): QuoteRecord {
        const alap = rekord({ szolgaltatasok: ['futesi_terv', 'klimaterv'], hotermelok: ['hoszivattyu'], mennyezetHutes: 'igen' });
        const osszeg = Math.round(alap.reszosszeg * 0.1);
        return { ...alap, kuponKod: 'nyar10', kedvezmeny: { tipus: 'kupon', cimke: 'x', alap: alap.reszosszeg, szazalek: 10, osszeg, kuponKod: 'NYAR10' }, vegosszeg: alap.reszosszeg - osszeg };
    }

    it('kuponnal: kupon-sor + energetikás címke + két végösszeg, feloldatlan token nélkül', async () => {
        const rec = kuponosRek();
        const szoveg = await szovegBol(rec);
        expect(szoveg).toContain('Kupon (NYAR10 – 10%)');
        expect(szoveg).toContain(`−${ezresPont(rec.kedvezmeny!.osszeg)},- Ft`);
        expect(szoveg).toContain('Végösszeg (Energetikai tanúsítvánnyal kalkulált összeg)');
        expect(szoveg).toContain(`${ezresPont(rec.vegosszeg!)},- Ft`);
        expect(szoveg).toContain(`${ezresPont(rec.vegosszeg! + 30000)},- Ft`);
        expect(szoveg).not.toMatch(TOKEN);
    });

    it('kupon nélkül: nincs kupon-sor, marad a két végösszeg', async () => {
        const rec = rekord({ szolgaltatasok: ['futesi_terv', 'klimaterv'], hotermelok: ['hoszivattyu'], mennyezetHutes: 'igen' });
        const szoveg = await szovegBol(rec);
        expect(szoveg).not.toContain('Kupon (');
        expect(szoveg).toContain(`${ezresPont(rec.vegosszeg!)},- Ft`);
        expect(szoveg).toContain(`${ezresPont(rec.vegosszeg! + 30000)},- Ft`);
        expect(szoveg).not.toMatch(TOKEN);
    });
});
