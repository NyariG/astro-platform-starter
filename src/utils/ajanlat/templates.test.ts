import { describe, expect, it } from 'vitest';
import { altalanosUgyfelLevel, ismeteltKiserletErtesito, lakoepuletUgyfelLevel, uzemeltetoiAdatlap } from './templates';
import type { QuoteRecord } from './store';
import { calculateQuote } from './pricing';

function rekord(felulir: Partial<QuoteRecord> = {}): QuoteRecord {
    const szolgaltatasok = felulir.szolgaltatasok ?? ['futesi_terv', 'szellozteto_terv'];
    const hotermelok = felulir.hotermelok ?? ['hoszivattyu'];
    const alapterulet = felulir.alapterulet !== undefined ? felulir.alapterulet : 120;
    const mennyezetHutes = felulir.mennyezetHutes ?? 'igen';

    const arazas = calculateQuote({
        szolgaltatasok,
        epuletTerulet: alapterulet,
        telekMeret: felulir.telekMeret ?? null,
        ontozendoTerulet: felulir.ontozendoTerulet ?? null,
        hotermelok,
        nincsHutes: mennyezetHutes === 'nem'
    });

    return {
        id: 'e1f9b0a2-0000-4000-8000-000000000001',
        nev: 'Teszt Elek',
        email: 'teszt@example.com',
        emailNormalized: 'teszt@example.com',
        telefon: '+36201234567',
        varos: 'Győr',
        ingatlanJelleg: 'lakoepulet',
        tervCelja: 'uj_epites',
        szintek: 2,
        pince: null,
        alapterulet,
        telekMeret: null,
        ontozendoTerulet: null,
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
        userAgent: 'teszt',
        sourceUrl: 'https://nyariterv.hu/ajanlat',
        createdAt: '2026-07-20T08:30:00.000Z',
        emailSentAt: null,
        emailError: null,
        ...felulir
    };
}

const sablonok = [
    ['lakóépület, ügyfél', () => lakoepuletUgyfelLevel(rekord())],
    ['ipari/egyéb, ügyfél', () => altalanosUgyfelLevel(rekord({ ingatlanJelleg: 'ipari' }))],
    ['üzemeltetői adatlap', () => uzemeltetoiAdatlap(rekord())],
    ['ismételt kísérlet, pontos sorszám', () => ismeteltKiserletErtesito(rekord({ status: 'blocked', attemptNumber: 3 }), true)],
    ['ismételt kísérlet, becsült sorszám', () => ismeteltKiserletErtesito(rekord({ status: 'blocked', attemptNumber: 3 }), false)]
] as const;

describe('e-mail sablonok — alapkövetelmények', () => {
    for (const [nev, keszit] of sablonok) {
        it(`${nev}: van tárgy, HTML és szöveges változat`, () => {
            const level = keszit();
            expect(level.subject.length).toBeGreaterThan(0);
            expect(level.text.length).toBeGreaterThan(0);
            expect(level.html).toContain('<!doctype html>');
            expect(level.html).toContain('</html>');
        });

        it(`${nev}: tartalmazza az ügyfél nevét`, () => {
            const level = keszit();
            expect(level.html).toContain('Teszt Elek');
            expect(level.text).toContain('Teszt Elek');
        });

        it(`${nev}: nem marad benne feloldatlan behelyettesítés`, () => {
            const level = keszit();
            expect(level.html).not.toContain('undefined');
            expect(level.html).not.toContain('[object Object]');
            expect(level.text).not.toContain('undefined');
        });
    }
});

describe('ipari / egyéb ügyfél-e-mail — nincs árajánlat', () => {
    it('nem tartalmaz árat, végösszeget vagy árajánlat-tételsort', () => {
        const level = altalanosUgyfelLevel(rekord({ ingatlanJelleg: 'ipari', szolgaltatasok: ['futesi_terv'], hotermelok: ['gazkazan'] }));
        expect(level.text).not.toContain('Ft');
        expect(level.text).not.toContain('Végösszeg');
        expect(level.text).not.toContain('árajánlat tételei');
        expect(level.html).not.toContain('Ft');
        expect(level.html).not.toContain('Végösszeg');
    });

    it('tartalmazza az egyedi árazás ígéretét és a megerősítést', () => {
        const level = altalanosUgyfelLevel(rekord({ ingatlanJelleg: 'egyeb' }));
        expect(level.text).toContain('egyedi árajánlattal');
        expect(level.text).toContain('megkaptuk');
    });

    it('a lakóépület ügyfél-e-mail a PDF-re utal, tételes árat a törzsben nem közöl', () => {
        const level = lakoepuletUgyfelLevel(rekord({ ingatlanJelleg: 'lakoepulet', szolgaltatasok: ['futesi_terv'], hotermelok: ['gazkazan'], alapterulet: 100 }));
        expect(level.text).not.toContain('Ft');
        expect(level.text).not.toContain('Végösszeg');
        expect(level.text).toContain('PDF-ben mellékeltük');
        expect(level.text).toContain('Kért szolgáltatások');
    });
});

describe('e-mail sablonok — tartalmi elvárások', () => {
    it('az opciók megjelenő nevét használja, nem a kulcsokat', () => {
        const level = uzemeltetoiAdatlap(rekord({ szolgaltatasok: ['futesi_terv', 'vizellatas_terv'], hotermelok: ['vegyestuzelesu'] }));
        expect(level.text).toContain('Vegyestüzelésű kazán');
        expect(level.text).toContain('Vízellátási terv');
        expect(level.text).not.toContain('vegyestuzelesu');
        expect(level.text).not.toContain('vizellatas_terv');
    });

    it('hőtermelő nélkül nem jelenít meg üres sort', () => {
        const level = uzemeltetoiAdatlap(rekord({ szolgaltatasok: ['szellozteto_terv'], hotermelok: [] }));
        expect(level.text).not.toContain('Hőtermelők');
    });

    it('hiányzó telefonszám helyén gondolatjel áll', () => {
        const level = uzemeltetoiAdatlap(rekord({ telefon: null }));
        expect(level.text).toContain('Telefon: —');
    });

    it('a dátumot budapesti idő szerint írja ki', () => {
        // 08:30 UTC → 10:30 Budapest (nyári időszámítás)
        const level = uzemeltetoiAdatlap(rekord());
        expect(level.text).toContain('10:30');
    });

    it('az ismételt kísérlet levele jelzi, hogy az ügyfél nem kapott levelet', () => {
        const level = ismeteltKiserletErtesito(rekord({ attemptNumber: 2 }), true);
        expect(level.text).toContain('NEM kapott levelet');
        expect(level.subject).toContain('Ismételt árajánlatkérés');
    });

    it('becsült sorszámnál ezt jelzi, pontosnál nem', () => {
        const becsult = ismeteltKiserletErtesito(rekord({ attemptNumber: 4 }), false);
        const pontos = ismeteltKiserletErtesito(rekord({ attemptNumber: 4 }), true);
        expect(becsult.text).toContain('becsült');
        expect(pontos.text).not.toContain('becsült');
        expect(becsult.subject).toContain('kb. 4.');
        expect(pontos.subject).toContain('4.');
    });

    it('a HTML-be kerülő felhasználói szöveget escape-eli', () => {
        const level = uzemeltetoiAdatlap(rekord({ nev: '<script>alert(1)</script>' }));
        expect(level.html).not.toContain('<script>alert(1)</script>');
        expect(level.html).toContain('&lt;script&gt;');
    });
});
