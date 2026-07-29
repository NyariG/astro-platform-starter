import { describe, expect, it } from 'vitest';
import { kuponHiba, kuponKeres, kuponListaHiba, kuponNormalizal, kuponTeljesKod, type Coupon } from './coupons';
import { calculateQuote, type QuoteInput } from './pricing';

const MA = '2026-07-25';

function kupon(felulir: Partial<Coupon> = {}): Coupon {
    return { elotag: 'NYAR', szazalek: 15, aktiv: true, ...felulir };
}

function bemenet(felulir: Partial<QuoteInput> = {}): QuoteInput {
    return {
        szolgaltatasok: [],
        epuletTerulet: null,
        telekMeret: null,
        ontozendoTerulet: null,
        hotermelok: [],
        nincsHutes: false,
        ...felulir
    };
}

describe('kód összeállítása és normalizálás', () => {
    it('a teljes kód = előtag + százalék, nullázás nélkül', () => {
        expect(kuponTeljesKod(kupon({ elotag: 'NYAR', szazalek: 5 }))).toBe('NYAR5');
        expect(kuponTeljesKod(kupon({ elotag: 'TAVASZ', szazalek: 100 }))).toBe('TAVASZ100');
    });

    it('a normalizálás trimel és nagybetűsít', () => {
        expect(kuponNormalizal('  nyar15  ')).toBe('NYAR15');
    });
});

describe('kuponHiba — konfiguráció-validáció', () => {
    it('túl rövid előtagot elutasít', () => {
        expect(kuponHiba(kupon({ elotag: 'AB' }))).toContain('3–12');
    });

    it('érvénytelen karaktert az előtagban elutasít', () => {
        expect(kuponHiba(kupon({ elotag: 'NY_R' }))).toContain('A–Z');
    });

    it('100 feletti százalékot elutasít', () => {
        expect(kuponHiba(kupon({ szazalek: 101 }))).toContain('0 és 100');
    });

    it('negatív százalékot elutasít', () => {
        expect(kuponHiba(kupon({ szazalek: -5 }))).toContain('0 és 100');
    });

    it('fordított érvényességi időszakot elutasít', () => {
        expect(kuponHiba(kupon({ ervenyesTol: '2026-08-01', ervenyesIg: '2026-07-01' }))).toContain('nem lehet későbbi');
    });

    it('a 0%-os kupon érvényes konfiguráció', () => {
        expect(kuponHiba(kupon({ szazalek: 0 }))).toBeNull();
    });
});

describe('kuponListaHiba — §8.2/9 duplikátum', () => {
    it('ismétlődő teljes kódot jelez', () => {
        const lista = [kupon({ elotag: 'NYAR', szazalek: 15 }), kupon({ elotag: 'NYAR', szazalek: 15 })];
        expect(kuponListaHiba(lista)).toContain('Ismétlődő');
    });

    it('a beváltás kis/nagybetűre nem érzékeny, de a konfig előtag kötelezően nagybetűs', () => {

        const lista = [kupon({ elotag: 'NYAR', szazalek: 15 }), kupon({ elotag: 'NYAR1', szazalek: 5 })];
        expect(kuponListaHiba(lista)).toContain('Ismétlődő');
    });

    it('különböző kódok listája rendben', () => {
        const lista = [kupon({ elotag: 'NYAR', szazalek: 15 }), kupon({ elotag: 'TEL', szazalek: 10 })];
        expect(kuponListaHiba(lista)).toBeNull();
    });
});

describe('kuponKeres — §8.2/7,8 állapotok', () => {
    const lista = [
        kupon({ elotag: 'AKTIV', szazalek: 15, aktiv: true }),
        kupon({ elotag: 'INAKTIV', szazalek: 10, aktiv: false }),
        kupon({ elotag: 'LEJART', szazalek: 20, aktiv: true, ervenyesIg: '2026-01-01' }),
        kupon({ elotag: 'JOVO', szazalek: 25, aktiv: true, ervenyesTol: '2026-12-01' })
    ];

    it('érvényes aktív kupont megtalál', () => {
        const { allapot } = kuponKeres('AKTIV15', MA, lista);
        expect(allapot).toBe('ervenyes');
    });

    it('kisbetűs és szóközös bevitel is beváltható (§8.2/8)', () => {
        expect(kuponKeres('  aktiv15 ', MA, lista).allapot).toBe('ervenyes');
    });

    it('inaktív kupon → inaktiv állapot', () => {
        expect(kuponKeres('INAKTIV10', MA, lista).allapot).toBe('inaktiv');
    });

    it('lejárt kupon → lejart állapot (§8.2/7)', () => {
        expect(kuponKeres('LEJART20', MA, lista).allapot).toBe('lejart');
    });

    it('még nem aktív kupon → meg_nem_aktiv', () => {
        expect(kuponKeres('JOVO25', MA, lista).allapot).toBe('meg_nem_aktiv');
    });

    it('nem létező kód → ismeretlen', () => {
        expect(kuponKeres('NINCSILYEN99', MA, lista).allapot).toBe('ismeretlen');
    });

    it('üres kód → ismeretlen', () => {
        expect(kuponKeres('', MA, lista).allapot).toBe('ismeretlen');
    });
});

describe('kupon a kalkulációban — §8.2/5,6', () => {
    it('a kupon százaléka a részösszegre hat', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv'] }), undefined, { kod: 'NYAR15', szazalek: 15 });

        expect(e.kedvezmeny?.tipus).toBe('kupon');
        expect(e.kedvezmeny?.osszeg).toBe(7_500);
        expect(e.vegosszeg).toBe(42_500);
    });

    it('100%-os kupon → végösszeg 0, nem negatív (§8.2/5)', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv'] }), undefined, { kod: 'TELJES100', szazalek: 100 });
        expect(e.vegosszeg).toBe(0);
    });

    it('a legkedvezőbb érvényesül: kupon nagyobb, mint a mennyezethűtés (§8.2/6, C7)', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 100, hotermelok: ['gazkazan'], nincsHutes: true }),
            undefined,
            { kod: 'NAGY30', szazalek: 30 }
        );

        expect(e.kedvezmeny?.tipus).toBe('kupon');
        expect(e.kedvezmeny?.osszeg).toBe(69_000);
    });

    it('a legkedvezőbb érvényesül: mennyezethűtés nagyobb, mint a kupon', () => {
        const e = calculateQuote(
            bemenet({ szolgaltatasok: ['futesi_terv'], epuletTerulet: 100, hotermelok: ['gazkazan'], nincsHutes: true }),
            undefined,
            { kod: 'KICSI1', szazalek: 1 }
        );

        expect(e.kedvezmeny?.tipus).toBe('mennyezet_hutes');
        expect(e.kedvezmeny?.osszeg).toBe(11_500);
    });

    it('a kupon hatóköre szűkíthető adott szolgáltatásra', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv', 'muszaki_leiras'] }), undefined, {
            kod: 'CSAKKLIMA20',
            szazalek: 20,
            hatokorSzolgaltatasok: ['klimaterv']
        });

        expect(e.kedvezmeny?.osszeg).toBe(10_000);
    });

    it('0%-os kupon nem ad kedvezményt', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv'] }), undefined, { kod: 'NULLA0', szazalek: 0 });
        expect(e.kedvezmeny).toBeNull();
        expect(e.vegosszeg).toBe(50_000);
    });

    it('kupon nélkül a végösszeg változatlan', () => {
        const e = calculateQuote(bemenet({ szolgaltatasok: ['klimaterv'] }));
        expect(e.vegosszeg).toBe(50_000);
    });
});
