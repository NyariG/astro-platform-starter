import { describe, expect, it } from 'vitest';
import { kapcsolatLevel, kapcsolatSema } from './kapcsolat';

const ervenyes = { nev: 'Teszt Elek', telefon: '', email: 'teszt@example.com', uzenet: 'Érdekelne egy tervezés.', adatkezeles: true, weboldal: '' };

describe('kapcsolatSema', () => {
    it('elfogadja az érvényes üzenetet telefon nélkül is', () => {
        expect(kapcsolatSema.safeParse(ervenyes).success).toBe(true);
    });

    it('elutasítja a hibás telefont, a hiányzó hozzájárulást és a rövid üzenetet', () => {
        const eredmeny = kapcsolatSema.safeParse({ ...ervenyes, telefon: 'abc', adatkezeles: false, uzenet: 'x' });
        expect(eredmeny.success).toBe(false);
        const mezok = eredmeny.success ? [] : eredmeny.error.issues.map((i) => i.path[0]);
        expect(mezok).toEqual(expect.arrayContaining(['telefon', 'adatkezeles', 'uzenet']));
    });

    it('a kitöltött csapdamező hibát ad', () => {
        expect(kapcsolatSema.safeParse({ ...ervenyes, weboldal: 'spam' }).success).toBe(false);
    });
});

describe('kapcsolatLevel', () => {
    it('escape-eli a HTML-t és tartalmazza az üzenetet', () => {
        const level = kapcsolatLevel(kapcsolatSema.parse({ ...ervenyes, uzenet: '<script>x</script> szöveg' }), 'https://nyariterv.hu/');
        expect(level.html).not.toContain('<script>');
        expect(level.text).toContain('<script>x</script> szöveg');
        expect(level.subject).toContain('Teszt Elek');
    });
});
