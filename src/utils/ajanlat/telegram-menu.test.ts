import { describe, expect, it } from 'vitest';
import { idopontRovid, napFormat } from './telegram-menu';

describe('idopontRovid — dátum + óra:perc, Europe/Budapest', () => {
    it('tömör ÉÉÉÉ.HH.NN. ÓÓ:PP formátum, nyári idő (UTC+2)', () => {
        expect(idopontRovid('2026-07-31T12:05:00.000Z')).toBe('2026.07.31. 14:05');
    });

    it('téli idő (UTC+1)', () => {
        expect(idopontRovid('2026-01-15T12:05:00.000Z')).toBe('2026.01.15. 13:05');
    });

    it('éjfél körüli napváltás budapesti idő szerint', () => {
        expect(idopontRovid('2026-07-31T22:30:00.000Z')).toBe('2026.08.01. 00:30');
    });

    it('érvénytelen időpont → —', () => {
        expect(idopontRovid('nem-datum')).toBe('—');
    });
});

describe('napFormat — dátum-csoport fejléc', () => {
    it('ÉÉÉÉ-HH-NN → ÉÉÉÉ.HH.NN.', () => {
        expect(napFormat('2026-07-31')).toBe('2026.07.31.');
    });
});
