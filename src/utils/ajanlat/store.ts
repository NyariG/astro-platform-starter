import { getStore } from '@netlify/blobs';
import type { Kedvezmeny, Tetel } from './pricing';

const STORE_NAME = 'ajanlatok';
const TIME_ZONE = 'Europe/Budapest';
const CAS_RETRIES = 3;

export type QuoteStatus = 'new' | 'sent' | 'failed' | 'blocked';

export type QuoteRecord = {
    id: string;

    nev: string;
    email: string;
    emailNormalized: string;
    telefon: string | null;
    varos: string;

    ingatlanJelleg: string;
    tervCelja: string;

    szintek: number | null;

    pince: boolean | null;

    alapterulet: number | null;
    telekMeret: number | null;
    ontozendoTerulet: number | null;

    szolgaltatasok: string[];
    hotermelok: string[];

    mennyezetHutes: string | null;

    hutesOpciok: string[];

    kuponKod: string | null;

    jogiNyilatkozatVerzio: string | null;

    tetelek: Tetel[];
    kedvezmeny: Kedvezmeny | null;
    reszosszeg: number;
    vegosszeg: number | null;
    vanEgyediArazas: boolean;
    arlistaVerzio: string;

    gdprConsent: boolean;

    status: QuoteStatus;
    attemptNumber: number;
    ip: string;
    userAgent: string;
    sourceUrl: string;
    createdAt: string;
    emailSentAt: string | null;
    emailError: string | null;
};

type QuotaEntry = {
    requestId: string;
    createdAt: string;
    attempts: number;
};

type IpEntry = {
    count: number;
};

export function readEnv(name: string): string | undefined {
    const runtime = typeof process !== 'undefined' ? process.env?.[name] : undefined;
    if (runtime) return runtime;
    const buildTime = (import.meta.env as Record<string, unknown>)[name];
    return typeof buildTime === 'string' && buildTime ? buildTime : undefined;
}

function store() {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
}

function requestKey(id: string): string {
    return `request/${id}`;
}

function quotaKey(date: string, emailNormalized: string): string {
    return `quota/${date}/${emailNormalized}`;
}

function ipQuotaKey(date: string, ipHash: string): string {
    return `ip/${date}/${ipHash}`;
}

/** A mai nap `YYYY-MM-DD` alakban, budapesti idő szerint. */
export function dateKey(now: Date = new Date()): string {
    // Az en-CA lokál ISO-sorrendű dátumot ad (2026-07-20), ellentétben a hu-HU-val.
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(now);
}

/** Trim + kisbetűsítés. Szándékosan nem kezeli a Gmail pont/+alias formáit. */
export function normalizeEmail(raw: string): string {
    return raw.trim().toLowerCase();
}

/**
 * A telefonszámból eltávolít minden nem számjegyet, a vezető `+` jelet megtartja.
 * Üres bemenetre `null`-t ad, mert a mező opcionális.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return null;
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;
    return trimmed.startsWith('+') ? `+${digits}` : digits;
}

/**
 * Az IP-cím rövidített SHA-256 lenyomata. A nyers IP a rekordban tárolódik
 * (audit mező), a kulcsban viszont csak a lenyomata szerepel.
 */
export async function hashIp(ip: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    return Array.from(new Uint8Array(digest))
        .slice(0, 8)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * Megkísérli lefoglalni az aznapi kvótát az adott e-mail címre.
 *
 * A `onlyIfNew` miatt ez atomi művelet: párhuzamos beküldéseknél pontosan
 * egy hívás kap `claimed: true`-t, a többi `false`-t.
 */
export async function claimQuota(emailNormalized: string, date: string, requestId: string): Promise<{ claimed: boolean }> {
    const entry: QuotaEntry = {
        requestId,
        createdAt: new Date().toISOString(),
        attempts: 1
    };
    const result = await store().setJSON(quotaKey(date, emailNormalized), entry, { onlyIfNew: true });
    return { claimed: result.modified };
}

/**
 * Növeli az aznapi kísérletszámlálót egy már foglalt kvótán, ETag-alapú
 * compare-and-set ciklussal.
 *
 * Ha a ciklus kimerül, `exact: false`-szal tér vissza — a sorszám ilyenkor
 * becsült, és az üzemeltetői értesítés is így jelzi. Inkább közelítő szám,
 * mint kimaradó figyelmeztetés.
 */
export async function registerAttempt(
    emailNormalized: string,
    date: string,
    requestId: string
): Promise<{ attempts: number; exact: boolean; reclaimed: boolean }> {
    const key = quotaKey(date, emailNormalized);

    for (let i = 0; i < CAS_RETRIES; i++) {
        const current = await store().getWithMetadata(key, { type: 'json', consistency: 'strong' });

        // A kvóta közben felszabadulhatott — például mert egy párhuzamos kérésnél
        // az e-mail küldése hibára futott, és visszavonta a foglalást. Ilyenkor ez
        // a kérés lesz az aznapi első, tehát a hívónak a sikeres ágon kell folytatnia.
        if (!current) {
            const { claimed } = await claimQuota(emailNormalized, date, requestId);
            if (claimed) return { attempts: 1, exact: true, reclaimed: true };
            continue;
        }

        const previous = (current.data as QuotaEntry) ?? { requestId, createdAt: new Date().toISOString(), attempts: 1 };
        const next: QuotaEntry = { ...previous, attempts: (previous.attempts ?? 1) + 1 };

        // ETag nélkül nincs mihez képest összehasonlítani: a feltételes írás
        // csendben feltétel nélkülivé válna. Ilyenkor megírjuk az értéket, de
        // a sorszámot becsültként jelöljük — az értesítés is így közli.
        if (!current.etag) {
            await store().setJSON(key, next);
            return { attempts: next.attempts, exact: false, reclaimed: false };
        }

        const result = await store().setJSON(key, next, { onlyIfMatch: current.etag });
        if (result.modified) return { attempts: next.attempts, exact: true, reclaimed: false };
    }

    const fallback = (await store().get(key, { type: 'json', consistency: 'strong' })) as QuotaEntry | null;
    return { attempts: (fallback?.attempts ?? 1) + 1, exact: false, reclaimed: false };
}

/**
 * Visszavonja az aznapi kvótafoglalást.
 *
 * Akkor hívjuk, ha az e-mail küldése hibára futott: a limit csak ott
 * érvényesüljön, ahol a folyamat ténylegesen végigment, különben egy
 * szolgáltatói hiba egy napra kizárná az ügyfelet.
 */
export async function releaseQuota(emailNormalized: string, date: string): Promise<void> {
    await store().delete(quotaKey(date, emailNormalized));
}

/**
 * Másodlagos, IP-alapú napi korlát.
 *
 * Szándékosan fail-open: ha a CAS ciklus kimerül, átengedi a kérést.
 * Ez csak spam-fék, és egy irodából vagy CGNAT mögül több jogos kérés is
 * érkezhet — valódi felhasználót nem zárhat ki egy versenyhelyzet miatt.
 */
export async function consumeIpQuota(ipHash: string, date: string, limit: number): Promise<boolean> {
    const key = ipQuotaKey(date, ipHash);

    for (let i = 0; i < CAS_RETRIES; i++) {
        const current = await store().getWithMetadata(key, { type: 'json', consistency: 'strong' });

        if (!current) {
            const result = await store().setJSON(key, { count: 1 } satisfies IpEntry, { onlyIfNew: true });
            if (result.modified) return true;
            continue;
        }

        const count = (current.data as IpEntry)?.count ?? 0;
        if (count >= limit) return false;

        const result = await store().setJSON(key, { count: count + 1 } satisfies IpEntry, { onlyIfMatch: current.etag });
        if (result.modified) return true;
    }

    return true;
}

/**
 * Egy Blobs-számláló atomi növelése limit-ellenőrzéssel, ETag-alapú CAS-sal.
 *
 * `limit == null` esetén nincs felső korlát, csak növel. Visszatérés: sikerült-e
 * a foglalás a limiten belül. A CAS kimerülésekor fail-closed (false), mert egy
 * beváltási limitet inkább szigorúan tartunk, mint túllépjük.
 */
async function consumeCounter(key: string, limit: number | null): Promise<boolean> {
    for (let i = 0; i < CAS_RETRIES; i++) {
        const current = await store().getWithMetadata(key, { type: 'json', consistency: 'strong' });

        if (!current) {
            if (limit !== null && limit < 1) return false;
            const result = await store().setJSON(key, { count: 1 } satisfies IpEntry, { onlyIfNew: true });
            if (result.modified) return true;
            continue;
        }

        const count = (current.data as IpEntry)?.count ?? 0;
        if (limit !== null && count >= limit) return false;

        const result = await store().setJSON(key, { count: count + 1 } satisfies IpEntry, { onlyIfMatch: current.etag });
        if (result.modified) return true;
    }
    return false;
}

function couponTotalKey(kod: string): string {
    return `coupon/${kod}/total`;
}

function couponEmailKey(kod: string, emailNormalized: string): string {
    return `coupon/${kod}/email/${emailNormalized}`;
}

/**
 * Megkísérli beváltani a kupont: ellenőrzi és növeli az összes- és az
 * e-mailenkénti számlálót. Csak akkor foglal, ha MINDKÉT limiten belül fér el.
 *
 * Az összes-számláló a szigorúbb, ezért azt foglaljuk előbb; ha az e-mail-limit
 * mégis blokkol, visszavonjuk az összes-foglalást, hogy ne szivárogjon el.
 */
export async function consumeCoupon(
    kod: string,
    emailNormalized: string,
    osszesMax: number | null,
    emailenkentiMax: number | null
): Promise<boolean> {
    const totalKey = couponTotalKey(kod);
    const osszesOk = await consumeCounter(totalKey, osszesMax);
    if (!osszesOk) return false;

    const emailOk = await consumeCounter(couponEmailKey(kod, emailNormalized), emailenkentiMax);
    if (!emailOk) {
        // Az összes-foglalás visszaadása, hogy egy blokkolt e-mail-limit ne
        // fogyassza a globális keretet.
        await releaseCounter(totalKey);
        return false;
    }
    return true;
}

/** Egy számláló csökkentése eggyel (nem megy nulla alá). Visszavonáshoz. */
async function releaseCounter(key: string): Promise<void> {
    for (let i = 0; i < CAS_RETRIES; i++) {
        const current = await store().getWithMetadata(key, { type: 'json', consistency: 'strong' });
        if (!current) return;
        const count = (current.data as IpEntry)?.count ?? 0;
        const result = await store().setJSON(key, { count: Math.max(0, count - 1) } satisfies IpEntry, { onlyIfMatch: current.etag });
        if (result.modified) return;
    }
}

/** Kupon-beváltás visszavonása, ha a beküldés később mégis hibára fut. */
export async function releaseCoupon(kod: string, emailNormalized: string): Promise<void> {
    await releaseCounter(couponTotalKey(kod));
    await releaseCounter(couponEmailKey(kod, emailNormalized));
}

export async function saveRequest(record: QuoteRecord): Promise<void> {
    await store().setJSON(requestKey(record.id), record);
}

function pdfKey(id: string): string {
    return `pdf/${id}`;
}

/**
 * A generált árajánlat-PDF tárolása a rekord azonosítója alatt.
 *
 * A Blobs nem támogat natív lejáratot; a `createdAt` metaadat egy későbbi,
 * ütemezett takarítás alapja lehet (a jóváhagyott 12 hónapos megőrzéshez).
 */
export async function savePdf(id: string, bytes: Uint8Array): Promise<void> {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await store().set(pdfKey(id), buffer, { metadata: { createdAt: new Date().toISOString() } });
}

/** A tárolt PDF bájtjai, vagy null, ha nincs ilyen. */
export async function getPdf(id: string): Promise<ArrayBuffer | null> {
    return (await store().get(pdfKey(id), { type: 'arrayBuffer' })) as ArrayBuffer | null;
}

/** Az árajánlat-sablon két változata a Blobsban. */
export type SablonTipus = 'nyers' | 'normalizalt';

function sablonKey(tipus: SablonTipus): string {
    return `sablon/${tipus}`;
}

/**
 * Az árajánlat-sablon egy változatának tárolása a Blobsban.
 * `nyers` = a kézzel szerkeszthető forrás; `normalizalt` = a futásidőben
 * kitölthető (docxtemplater-tagelt) változat.
 */
export async function saveSablon(tipus: SablonTipus, bytes: Uint8Array): Promise<void> {
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    await store().set(sablonKey(tipus), buffer, { metadata: { createdAt: new Date().toISOString() } });
}

/** A tárolt sablon bájtjai, vagy null, ha nincs ilyen. */
export async function getSablon(tipus: SablonTipus): Promise<ArrayBuffer | null> {
    return (await store().get(sablonKey(tipus), { type: 'arrayBuffer' })) as ArrayBuffer | null;
}

/** Egy meglévő rekord részleges frissítése (státusz, küldési időbélyeg, hiba). */
export async function patchRequest(id: string, patch: Partial<QuoteRecord>): Promise<void> {
    const key = requestKey(id);
    const current = (await store().get(key, { type: 'json', consistency: 'strong' })) as QuoteRecord | null;
    if (!current) return;
    await store().setJSON(key, { ...current, ...patch });
}
