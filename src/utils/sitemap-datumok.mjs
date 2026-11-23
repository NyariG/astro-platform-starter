import { execSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BLOG_MAPPA = 'src/content/blog';

const OLDAL_FORRASOK = {
    '/': ['src/pages/index.astro', 'src/components/Contact.astro'],
    '/energetikai-tanusitvany/': ['src/pages/energetikai-tanusitvany.astro', 'src/components/TanusitvanyArajanlat.astro'],
    '/tagtartaly-meretezo/': ['src/pages/tagtartaly-meretezo.astro', 'src/components/TagtartalyMeretezo.astro'],
    '/adatkezelesi/': ['src/pages/adatkezelesi.astro'],
    '/ajanlat/': ['src/pages/ajanlat/index.astro'],
    '/blog/': ['src/pages/blog/index.astro']
};

function frontmatterDatum(szoveg, mezo) {
    const talalat = szoveg.match(new RegExp(`^${mezo}:\\s*['"]?(\\d{4}-\\d{2}-\\d{2})`, 'm'));
    return talalat ? new Date(talalat[1]) : undefined;
}

function cikkDatumok() {
    const datumok = new Map();
    for (const fajl of readdirSync(BLOG_MAPPA).filter((nev) => nev.endsWith('.md'))) {
        const szoveg = readFileSync(join(BLOG_MAPPA, fajl), 'utf8');
        if (/^vazlat:\s*true/m.test(szoveg)) continue;
        const datum = frontmatterDatum(szoveg, 'frissitve') ?? frontmatterDatum(szoveg, 'megjelent');
        const kategoria = szoveg.match(/^kategoria:\s*['"]?([\w-]+)/m)?.[1];
        if (datum) datumok.set(fajl.replace(/\.md$/, ''), { datum, kategoria });
    }
    return datumok;
}

function gitDatum(fajlok) {
    try {
        const kimenet = execSync(`git log -1 --format=%cI -- ${fajlok.map((f) => `"${f}"`).join(' ')}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        return kimenet ? new Date(kimenet) : undefined;
    } catch {
        return undefined;
    }
}

function legkesobb(...datumok) {
    const ervenyes = datumok.filter(Boolean);
    return ervenyes.length ? new Date(Math.max(...ervenyes.map((d) => d.getTime()))) : undefined;
}

export function sitemapLastmod() {
    const cikkek = cikkDatumok();
    const legujabbCikk = legkesobb(...[...cikkek.values()].map((c) => c.datum));
    const oldalDatumok = Object.fromEntries(Object.entries(OLDAL_FORRASOK).map(([utvonal, fajlok]) => [utvonal, gitDatum(fajlok)]));

    return (elem) => {
        const utvonal = new URL(elem.url).pathname;
        const cikk = utvonal.match(/^\/blog\/([^/]+)\/$/)?.[1];
        const kategoria = utvonal.match(/^\/blog\/kategoria\/([^/]+)\/$/)?.[1];
        let datum;
        if (cikk && cikkek.has(cikk)) datum = cikkek.get(cikk).datum;
        else if (kategoria) datum = legkesobb(...[...cikkek.values()].filter((c) => c.kategoria === kategoria).map((c) => c.datum));
        else if (utvonal === '/' || utvonal === '/blog/') datum = legkesobb(oldalDatumok[utvonal], legujabbCikk);
        else datum = oldalDatumok[utvonal];
        if (datum) elem.lastmod = datum.toISOString();
        return elem;
    };
}
