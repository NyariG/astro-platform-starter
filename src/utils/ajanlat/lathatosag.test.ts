import { describe, expect, it } from 'vitest';
import { effektivUrlap, kliensExtraHibak, mezoLathato, normalizalAllapot, type LathatosagBemenet } from './lathatosag';

function v(over: Partial<LathatosagBemenet> = {}): LathatosagBemenet {
    return {
        szolgaltatasok: [],
        hotermelok: [],
        mennyezetHutes: '',
        hutesOpciok: [],
        hutesTervAktiv: false,
        kertepitesAktiv: false,
        ...over
    };
}

describe('normalizalAllapot — a hűtési kiválasztások nem ragadnak be', () => {
    it('csoport zárva: klíma, hűtési opciók és a válasz is nullázódik (a hőszivattyú marad)', () => {
        const e = normalizalAllapot(v({ szolgaltatasok: ['klimaterv', 'futesi_terv'], hotermelok: ['hoszivattyu'], hutesOpciok: ['fan_coil'], mennyezetHutes: 'igen', hutesTervAktiv: false }));
        expect(e.szolgaltatasok).toEqual(['futesi_terv']);
        expect(e.hutesOpciok).toEqual([]);
        expect(e.mennyezetHutes).toBe('');
        expect(e.hotermelok).toEqual(['hoszivattyu']);
    });

    it('„Nem": klíma és hűtési opciók törlődnek, a válasz (kedvezmény) marad', () => {
        const e = normalizalAllapot(v({ szolgaltatasok: ['klimaterv'], hotermelok: ['hoszivattyu'], hutesOpciok: ['fan_coil', 'mennyezet'], mennyezetHutes: 'nem', hutesTervAktiv: true }));
        expect(e.szolgaltatasok).toEqual([]);
        expect(e.hutesOpciok).toEqual([]);
        expect(e.mennyezetHutes).toBe('nem');
        expect(e.hotermelok).toEqual(['hoszivattyu']);
    });

    it('„Igen" + hőszivattyú: Fan-coil és Mennyezethűtés megmarad', () => {
        const e = normalizalAllapot(v({ hotermelok: ['hoszivattyu'], hutesOpciok: ['fan_coil', 'mennyezet'], mennyezetHutes: 'igen', hutesTervAktiv: true }));
        expect(e.hutesOpciok).toEqual(['fan_coil', 'mennyezet']);
    });

    it('„Igen", de nincs hőszivattyú: Fan-coil és Mennyezethűtés törlődik', () => {
        const e = normalizalAllapot(v({ hotermelok: ['gazkazan'], hutesOpciok: ['fan_coil', 'mennyezet'], mennyezetHutes: 'igen', hutesTervAktiv: true }));
        expect(e.hutesOpciok).toEqual([]);
    });
});

describe('effektivUrlap — a beküldött/árazott értékek', () => {
    it('Kertépítés zárva: a kert-szolgáltatások kiesnek', () => {
        const e = effektivUrlap(v({ szolgaltatasok: ['kert_koncepcio', 'ontozorendszer', 'futesi_terv'], hotermelok: ['gazkazan'], kertepitesAktiv: false }));
        expect(e.szolgaltatasok).toEqual(['futesi_terv']);
    });

    it('Kertépítés nyitva: a kert-szolgáltatások megmaradnak', () => {
        const e = effektivUrlap(v({ szolgaltatasok: ['kert_koncepcio'], kertepitesAktiv: true }));
        expect(e.szolgaltatasok).toEqual(['kert_koncepcio']);
    });

    it('Fűtési terv nélkül a hőtermelő és a hőszivattyú-függő alopciók kiesnek', () => {
        const e = effektivUrlap(v({ szolgaltatasok: ['szellozteto_terv'], hotermelok: ['hoszivattyu'], hutesOpciok: ['fan_coil'], mennyezetHutes: 'igen', hutesTervAktiv: true }));
        expect(e.hotermelok).toEqual([]);
        expect(e.hutesOpciok).toEqual([]);
    });

    it('a hűtési blokk normalizálását is alkalmazza (zárt csoport → tiszta)', () => {
        const e = effektivUrlap(v({ szolgaltatasok: ['klimaterv'], hutesOpciok: ['fan_coil'], mennyezetHutes: 'igen', hutesTervAktiv: false }));
        expect(e.szolgaltatasok).toEqual([]);
        expect(e.hutesOpciok).toEqual([]);
    });

    it('a nem érintett mezőket érintetlenül továbbadja', () => {
        const e = effektivUrlap({ ...v({ szolgaltatasok: ['muszaki_leiras'] }), nev: 'Teszt' } as LathatosagBemenet & { nev: string });
        expect((e as { nev: string }).nev).toBe('Teszt');
    });
});

describe('mezoLathato', () => {
    it('alapterület látszik épület-alapú szolgáltatásnál', () => {
        expect(mezoLathato(v({ szolgaltatasok: ['szellozteto_terv'] })).alapterulet).toBe(true);
        expect(mezoLathato(v({ szolgaltatasok: ['muszaki_leiras'] })).alapterulet).toBe(false);
    });

    it('a kert-területek csak nyitott Kertépítésnél látszanak', () => {
        expect(mezoLathato(v({ szolgaltatasok: ['ontozorendszer'], kertepitesAktiv: false })).ontozendoTerulet).toBe(false);
        expect(mezoLathato(v({ szolgaltatasok: ['ontozorendszer'], kertepitesAktiv: true })).ontozendoTerulet).toBe(true);
    });

    it('a hűtési kérdés a csoport nyitottságát követi', () => {
        expect(mezoLathato(v({ hutesTervAktiv: false })).hutesKerdes).toBe(false);
        expect(mezoLathato(v({ hutesTervAktiv: true })).hutesKerdes).toBe(true);
    });

    it('Fan-coil/Mennyezethűtés csak „igen" + fűtési hőszivattyú esetén', () => {
        expect(mezoLathato(v({ hutesTervAktiv: true, mennyezetHutes: 'igen', hotermelok: ['hoszivattyu'] })).fanCoilMennyezet).toBe(true);
        expect(mezoLathato(v({ hutesTervAktiv: true, mennyezetHutes: 'igen', hotermelok: ['gazkazan'] })).fanCoilMennyezet).toBe(false);
        expect(mezoLathato(v({ hutesTervAktiv: true, mennyezetHutes: 'nem', hotermelok: ['hoszivattyu'] })).fanCoilMennyezet).toBe(false);
    });
});

describe('kliensExtraHibak — UI-kapuzott kötelezőségek', () => {
    it('Hűtési terv nyitva, de nincs válasz → hiba', () => {
        expect(kliensExtraHibak(v({ hutesTervAktiv: true, mennyezetHutes: '' })).mennyezetHutes).toBeTruthy();
    });

    it('Hűtési terv nyitva, van válasz → nincs hiba', () => {
        expect(kliensExtraHibak(v({ hutesTervAktiv: true, mennyezetHutes: 'nem' })).mennyezetHutes).toBeUndefined();
    });

    it('Kertépítés nyitva, de nincs kiválasztott gyerek → hiba', () => {
        expect(kliensExtraHibak(v({ kertepitesAktiv: true, szolgaltatasok: [] })).kertepites).toBeTruthy();
    });

    it('Kertépítés nyitva, van gyerek → nincs hiba', () => {
        expect(kliensExtraHibak(v({ kertepitesAktiv: true, szolgaltatasok: ['kert_koncepcio'] })).kertepites).toBeUndefined();
    });

    it('zárt csoportoknál nincs extra hiba', () => {
        expect(kliensExtraHibak(v())).toEqual({});
    });
});
