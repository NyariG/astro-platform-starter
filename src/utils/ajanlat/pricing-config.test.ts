import { describe, expect, it } from 'vitest';
import { savKonfigHibak, type Szolgaltatas } from './pricing-config';

describe('savKonfigHibak — az éles konfiguráció', () => {
    it('hibátlan: minden sávos szolgáltatás sávjai szigorúan növekvők, hézag- és átfedésmentesek', () => {
        expect(savKonfigHibak()).toEqual([]);
    });
});

function savosSzolgaltatas(savok: { max: number; ar: number }[]): Szolgaltatas {
    return {
        kod: 'proba',
        megnevezes: 'Próba',
        arazas: { tipus: 'sav', teruletFajta: 'epulet', savok, egyediUzenet: 'egyedi' }
    };
}

describe('savKonfigHibak — hibás konfigurációk felismerése', () => {
    it('jelzi az üres sávlistát', () => {
        const hibak = savKonfigHibak([savosSzolgaltatas([])]);
        expect(hibak).toHaveLength(1);
        expect(hibak[0]).toContain('legalább egy sávot');
    });

    it('jelzi a nem szigorúan növekvő sávokat', () => {
        const hibak = savKonfigHibak([
            savosSzolgaltatas([
                { max: 100, ar: 1000 },
                { max: 50, ar: 2000 }
            ])
        ]);
        expect(hibak.some((h) => h.includes('nem szigorúan növekvők'))).toBe(true);
    });

    it('jelzi az azonos felső határú (átfedő) sávokat', () => {
        const hibak = savKonfigHibak([
            savosSzolgaltatas([
                { max: 100, ar: 1000 },
                { max: 100, ar: 2000 }
            ])
        ]);
        expect(hibak.some((h) => h.includes('nem szigorúan növekvők'))).toBe(true);
    });

    it('jelzi a nem pozitív egész felső határt', () => {
        expect(savKonfigHibak([savosSzolgaltatas([{ max: 0, ar: 1000 }])]).some((h) => h.includes('nem pozitív egész'))).toBe(true);
        expect(savKonfigHibak([savosSzolgaltatas([{ max: 100.5, ar: 1000 }])]).some((h) => h.includes('nem pozitív egész'))).toBe(true);
        expect(savKonfigHibak([savosSzolgaltatas([{ max: -10, ar: 1000 }])]).some((h) => h.includes('nem pozitív egész'))).toBe(true);
    });

    it('jelzi az érvénytelen árat', () => {
        expect(savKonfigHibak([savosSzolgaltatas([{ max: 100, ar: -5 }])]).some((h) => h.includes('nem érvényes'))).toBe(true);
        expect(savKonfigHibak([savosSzolgaltatas([{ max: 100, ar: 1000.5 }])]).some((h) => h.includes('nem érvényes'))).toBe(true);
    });

    it('a helyes, növekvő sávokat elfogadja', () => {
        const hibak = savKonfigHibak([
            savosSzolgaltatas([
                { max: 102, ar: 200_000 },
                { max: 153, ar: 230_000 },
                { max: 200, ar: 240_000 }
            ])
        ]);
        expect(hibak).toEqual([]);
    });

    it('a fix díjas és egységáras szolgáltatásokat érintetlenül hagyja', () => {
        const fix: Szolgaltatas = { kod: 'fix', megnevezes: 'Fix', arazas: { tipus: 'fix', ar: 60_000 } };
        const egyseg: Szolgaltatas = { kod: 'egyseg', megnevezes: 'Egység', arazas: { tipus: 'egysegar', teruletFajta: 'ontozes', egysegar: 109, minimumDij: 40_000 } };
        expect(savKonfigHibak([fix, egyseg])).toEqual([]);
    });
});
