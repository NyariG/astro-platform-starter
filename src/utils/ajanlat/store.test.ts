import { describe, expect, it } from 'vitest';
import { dateKey, normalizeEmail, normalizePhone } from './store';
import { maszkoltEmail } from './email';

describe('dateKey — budapesti naptári nap', () => {
    it('ISO sorrendű dátumot ad', () => {
        expect(dateKey(new Date('2026-07-20T10:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('nyári időszámításban a UTC este már a következő budapesti nap', () => {

        expect(dateKey(new Date('2026-07-19T23:00:00Z'))).toBe('2026-07-20');
    });

    it('nyári időszámításban a UTC 21:00 még aznap van', () => {

        expect(dateKey(new Date('2026-07-19T21:00:00Z'))).toBe('2026-07-19');
    });

    it('téli időszámításban is helyesen vált napot', () => {

        expect(dateKey(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16');
        expect(dateKey(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15');
    });

    it('a napváltás pillanatában a helyes napot adja', () => {
        expect(dateKey(new Date('2026-07-19T22:00:00Z'))).toBe('2026-07-20');
        expect(dateKey(new Date('2026-07-19T21:59:59Z'))).toBe('2026-07-19');
    });
});

describe('normalizeEmail', () => {
    it('kisbetűsít és levágja a szóközöket', () => {
        expect(normalizeEmail('  Teszt.Elek@Example.COM ')).toBe('teszt.elek@example.com');
    });

    it('a nagybetűs változat nem kerüli meg a limitet', () => {
        expect(normalizeEmail('TESZT@EXAMPLE.COM')).toBe(normalizeEmail('teszt@example.com'));
    });

    it('a szóközzel körbevett változat nem kerüli meg a limitet', () => {
        expect(normalizeEmail(' teszt@example.com ')).toBe(normalizeEmail('teszt@example.com'));
    });

    it('a Gmail pont és +alias formákat szándékosan megkülönbözteti', () => {
        expect(normalizeEmail('a.b@gmail.com')).not.toBe(normalizeEmail('ab@gmail.com'));
        expect(normalizeEmail('a+ajanlat@gmail.com')).not.toBe(normalizeEmail('a@gmail.com'));
    });
});

describe('normalizePhone', () => {
    it('üres bemenetre null', () => {
        expect(normalizePhone('')).toBeNull();
        expect(normalizePhone('   ')).toBeNull();
        expect(normalizePhone(null)).toBeNull();
        expect(normalizePhone(undefined)).toBeNull();
    });

    it('megtartja a vezető plusz jelet', () => {
        expect(normalizePhone('+36 20 123 4567')).toBe('+36201234567');
    });

    it('eltávolítja a kötőjelet és zárójelet', () => {
        expect(normalizePhone('06-20-123-4567')).toBe('06201234567');
        expect(normalizePhone('(06) 20 123 4567')).toBe('06201234567');
    });

    it('csak írásjelet tartalmazó bemenetre null', () => {
        expect(normalizePhone('---')).toBeNull();
    });
});

describe('maszkoltEmail — naplózás', () => {
    it('csak az első karaktert és a domaint hagyja meg', () => {
        expect(maszkoltEmail('teszt@example.com')).toBe('t***@example.com');
    });

    it('hibás alakra sem szivárogtat', () => {
        expect(maszkoltEmail('nincs-kukac')).toBe('***');
    });
});
