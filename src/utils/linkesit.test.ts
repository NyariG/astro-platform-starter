import { describe, expect, it } from 'vitest';
import { linkesit } from './linkesit';

describe('linkesit', () => {
    it('a domaint kattintható külső linkké alakítja, a mondatvégi pontot kint hagyja', () => {
        expect(linkesit('A gepeszabc.hu oldalon vásárolható meg.')).toBe('A <a href="https://gepeszabc.hu" target="_blank" rel="noopener">gepeszabc.hu</a> oldalon vásárolható meg.');
    });

    it('az e-mail-címből mailto linket csinál', () => {
        expect(linkesit('Írjon: info@nyariterv.hu.')).toBe('Írjon: <a href="mailto:info@nyariterv.hu">info@nyariterv.hu</a>.');
    });

    it('a saját domain nem nyílik új lapon', () => {
        expect(linkesit('https://nyariterv.hu/blog/')).toBe('<a href="https://nyariterv.hu/blog/">https://nyariterv.hu/blog/</a>');
    });

    it('a HTML-t escape-eli, számokat nem linkesít', () => {
        expect(linkesit('<b>1,5 millió</b> és 3.5 kW')).toBe('&lt;b&gt;1,5 millió&lt;/b&gt; és 3.5 kW');
    });
});
