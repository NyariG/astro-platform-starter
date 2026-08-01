import { describe, expect, it } from 'vitest';
import { effektivUrlap, kliensExtraHibak, mezoLathato, normalizalAllapot, type LathatosagBemenet } from './lathatosag';

function v(over: Partial<LathatosagBemenet> = {}): LathatosagBemenet {
    return {
        szolgaltatasok: [],
        hotermelok: [],
        mennyezetHutes: '',
        hutesOpciok: [],
        kertepitesAktiv: false,
        ...over
    };
}

const HUTHETO = { szolgaltatasok: ['futesi_terv'], hotermelok: ['hoszivattyu'] };

describe('normalizalAllapot — a hűtési kiválasztások nem ragadnak be', () => {
    it('nincs hőszivattyú: a válasz és a hűtési opciók nullázódnak', () => {
        const e = normalizalAllapot(v({ szolgaltatasok: ['futesi_terv'], hotermelok: ['gazkazan'], hutesOpciok: ['fan_coil'], mennyezetHutes: 'igen' }));
        expect(e.mennyezetHutes).toBe('');
        expect(e.hutesOpciok).toEqual([]);
    });

    it('nincs fűtési terv: a válasz és a hűtési opciók nullázódnak', () => {
        const e = normalizalAllapot(v({ szolgaltatasok: ['szellozteto_terv'], hotermelok: ['hoszivattyu'], hutesOpciok: ['fan_coil'], mennyezetHutes: 'igen' }));
        expect(e.mennyezetHutes).toBe('');
        expect(e.hutesOpciok).toEqual([]);
    });

    it('hőszivattyú + „Nem": a hűtési opciók törlődnek, a válasz (kedvezmény) marad', () => {
        const e = normalizalAllapot(v({ ...HUTHETO, hutesOpciok: ['fan_coil', 'mennyezet'], mennyezetHutes: 'nem' }));
        expect(e.hutesOpciok).toEqual([]);
        expect(e.mennyezetHutes).toBe('nem');
    });

    it('hőszivattyú + „Igen": Fan-coil és Mennyezethűtés megmarad', () => {
        const e = normalizalAllapot(v({ ...HUTHETO, hutesOpciok: ['fan_coil', 'mennyezet'], mennyezetHutes: 'igen' }));
        expect(e.hutesOpciok).toEqual(['fan_coil', 'mennyezet']);
    });

    it('a Klímaterv sima szolgáltatásként megmarad', () => {
        const e = normalizalAllapot(v({ szolgaltatasok: ['klimaterv', 'futesi_terv'], hotermelok: ['gazkazan'] }));
        expect(e.szolgaltatasok).toContain('klimaterv');
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

    it('Fűtési terv nélkül a hőtermelő és a hűtési opciók kiesnek', () => {
        const e = effektivUrlap(v({ szolgaltatasok: ['szellozteto_terv'], hotermelok: ['hoszivattyu'], hutesOpciok: ['fan_coil'], mennyezetHutes: 'igen' }));
        expect(e.hotermelok).toEqual([]);
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

    it('a hűtési kérdés csak fűtési terv + hőszivattyú esetén látszik', () => {
        expect(mezoLathato(v(HUTHETO)).hutesKerdes).toBe(true);
        expect(mezoLathato(v({ szolgaltatasok: ['futesi_terv'], hotermelok: ['gazkazan'] })).hutesKerdes).toBe(false);
        expect(mezoLathato(v({ hotermelok: ['hoszivattyu'] })).hutesKerdes).toBe(false);
    });

    it('Fan-coil/Mennyezethűtés csak „igen" esetén', () => {
        expect(mezoLathato(v({ ...HUTHETO, mennyezetHutes: 'igen' })).hutesAlopciok).toBe(true);
        expect(mezoLathato(v({ ...HUTHETO, mennyezetHutes: 'nem' })).hutesAlopciok).toBe(false);
    });
});

describe('kliensExtraHibak — UI-kapuzott kötelezőségek', () => {
    it('hőszivattyú, de nincs hűtési válasz → hiba', () => {
        expect(kliensExtraHibak(v({ ...HUTHETO, mennyezetHutes: '' })).mennyezetHutes).toBeTruthy();
    });

    it('hőszivattyú, van válasz → nincs kérdés-hiba', () => {
        expect(kliensExtraHibak(v({ ...HUTHETO, mennyezetHutes: 'nem' })).mennyezetHutes).toBeUndefined();
    });

    it('„Igen", de nincs hűtési opció → hiba', () => {
        expect(kliensExtraHibak(v({ ...HUTHETO, mennyezetHutes: 'igen', hutesOpciok: [] })).hutesOpciok).toBeTruthy();
    });

    it('„Igen", van legalább egy opció → nincs hiba', () => {
        expect(kliensExtraHibak(v({ ...HUTHETO, mennyezetHutes: 'igen', hutesOpciok: ['fan_coil'] })).hutesOpciok).toBeUndefined();
    });

    it('Kertépítés nyitva, de nincs kiválasztott gyerek → hiba', () => {
        expect(kliensExtraHibak(v({ kertepitesAktiv: true, szolgaltatasok: [] })).kertepites).toBeTruthy();
    });

    it('nincs hőszivattyú és zárt csoportok → nincs extra hiba', () => {
        expect(kliensExtraHibak(v())).toEqual({});
    });
});
