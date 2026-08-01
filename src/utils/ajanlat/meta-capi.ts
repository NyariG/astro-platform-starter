import { readEnv, type QuoteRecord } from './store';

const GRAPH_BASE = 'https://graph.facebook.com';

type Kontextus = {
    cookie: string;
    ip: string;
    userAgent: string;
    sourceUrl: string;
};

function verzio(): string {
    return readEnv('META_GRAPH_API_VERSION') || 'v23.0';
}

export function metaCapiKonfiguralva(): boolean {
    return Boolean(readEnv('META_PIXEL_ID') && readEnv('META_CAPI_ACCESS_TOKEN'));
}

async function sha256(ertek: string): Promise<string> {
    const adat = new TextEncoder().encode(ertek);
    const digest = await crypto.subtle.digest('SHA-256', adat);
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function normEmail(ertek: string): string {
    return ertek.trim().toLowerCase();
}

function normTelefon(ertek: string): string {
    return ertek.replace(/\D/g, '');
}

function normSzoveg(ertek: string): string {
    return ertek.trim().toLowerCase().replace(/\s+/g, ' ');
}

function nevReszek(nev: string): { vezeteknev: string; keresztnev: string } {
    const darabok = nev.trim().split(/\s+/).filter(Boolean);
    if (darabok.length === 0) return { vezeteknev: '', keresztnev: '' };
    if (darabok.length === 1) return { vezeteknev: darabok[0], keresztnev: '' };
    return { vezeteknev: darabok[0], keresztnev: darabok.slice(1).join(' ') };
}

function sutiErtek(cookie: string, nev: string): string {
    const parok = cookie ? cookie.split(';') : [];
    for (const par of parok) {
        const [kulcs, ...ertek] = par.trim().split('=');
        if (kulcs === nev) return decodeURIComponent(ertek.join('='));
    }
    return '';
}

async function hashLista(ertek: string, norm: (s: string) => string): Promise<string[] | undefined> {
    const tiszta = norm(ertek);
    if (!tiszta) return undefined;
    return [await sha256(tiszta)];
}

async function felhasznaloiAdat(record: QuoteRecord, kontextus: Kontextus): Promise<Record<string, unknown>> {
    const { vezeteknev, keresztnev } = nevReszek(record.nev);
    const [em, ph, ln, fn, ct] = await Promise.all([
        hashLista(record.email, normEmail),
        record.telefon ? hashLista(record.telefon, normTelefon) : Promise.resolve(undefined),
        hashLista(vezeteknev, normSzoveg),
        hashLista(keresztnev, normSzoveg),
        hashLista(record.varos, normSzoveg)
    ]);

    const adat: Record<string, unknown> = {};
    if (em) adat.em = em;
    if (ph) adat.ph = ph;
    if (ln) adat.ln = ln;
    if (fn) adat.fn = fn;
    if (ct) adat.ct = ct;
    adat.country = [await sha256('hu')];

    const fbp = sutiErtek(kontextus.cookie, '_fbp');
    const fbc = sutiErtek(kontextus.cookie, '_fbc');
    if (fbp) adat.fbp = fbp;
    if (fbc) adat.fbc = fbc;
    if (kontextus.ip) adat.client_ip_address = kontextus.ip;
    if (kontextus.userAgent) adat.client_user_agent = kontextus.userAgent;

    return adat;
}

function egyediAdat(record: QuoteRecord): Record<string, unknown> {
    const adat: Record<string, unknown> = {
        content_category: 'arajanlat',
        content_name: record.ingatlanJelleg
    };
    if (!record.vanEgyediArazas && typeof record.vegosszeg === 'number') {
        adat.value = record.vegosszeg;
        adat.currency = 'HUF';
    }
    return adat;
}

export async function kuldCapiLead(record: QuoteRecord, kontextus: Kontextus): Promise<void> {
    if (!metaCapiKonfiguralva()) return;
    const pixelId = String(readEnv('META_PIXEL_ID'));
    const token = String(readEnv('META_CAPI_ACCESS_TOKEN'));
    const testKod = readEnv('META_TEST_EVENT_CODE');

    const esemeny = {
        event_name: 'Lead',
        event_time: Math.floor(new Date(record.createdAt).getTime() / 1000),
        event_id: record.id,
        action_source: 'website',
        event_source_url: kontextus.sourceUrl,
        user_data: await felhasznaloiAdat(record, kontextus),
        custom_data: egyediAdat(record)
    };

    const test = testKod ? { test_event_code: testKod } : {};
    const url = `${GRAPH_BASE}/${verzio()}/${pixelId}/events`;

    const valasz = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [esemeny], access_token: token, ...test })
    });

    if (!valasz.ok) {
        const reszlet = await valasz.text().catch(() => '');
        throw new Error(`Meta CAPI ${valasz.status}: ${reszlet.slice(0, 300)}`);
    }
}
