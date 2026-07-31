import { getStore } from '@netlify/blobs';

const STORE_NAME = 'telegram';
const TOKEN_TTL_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const RATE_ABLAK_MS = 60 * 1000;

function store() {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export type TelegramAdmin = {
    chatId: number;
    username: string | null;
    linkedAt: string;
};

function adminKey(chatId: number): string {
    return `admin/${chatId}`;
}

export async function linkAdmin(chatId: number, username: string | null): Promise<void> {
    const rekord: TelegramAdmin = { chatId, username, linkedAt: new Date().toISOString() };
    await store().setJSON(adminKey(chatId), rekord);
}

export async function unlinkAdmin(chatId: number): Promise<void> {
    await store().delete(adminKey(chatId));
}

export async function isAdmin(chatId: number): Promise<boolean> {
    return (await store().get(adminKey(chatId), { type: 'json' })) !== null;
}

export async function listAdmins(): Promise<TelegramAdmin[]> {
    const { blobs } = await store().list({ prefix: 'admin/' });
    const adminok: TelegramAdmin[] = [];
    for (const blob of blobs) {
        const rekord = (await store().get(blob.key, { type: 'json' })) as TelegramAdmin | null;
        if (rekord) adminok.push(rekord);
    }
    return adminok;
}

export async function createLinkToken(token: string): Promise<void> {
    const most = Date.now();
    await store().setJSON(`token/${token}`, { createdAt: most, expiresAt: most + TOKEN_TTL_MS });
}

export async function consumeLinkToken(token: string): Promise<boolean> {
    const key = `token/${token}`;
    const rekord = await store().getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (!rekord) return false;

    const adat = rekord.data as { expiresAt: number; consumed?: boolean };
    if (adat.consumed || Date.now() > adat.expiresAt) {
        await store().delete(key);
        return false;
    }

    const eredmeny = await store().setJSON(key, { ...adat, consumed: true }, { onlyIfMatch: rekord.etag });
    if (!eredmeny.modified) return false;

    await store().delete(key);
    return true;
}

export async function markUpdateProcessed(updateId: number): Promise<boolean> {
    const eredmeny = await store().setJSON(`update/${updateId}`, { at: Date.now() }, { onlyIfNew: true });
    return eredmeny.modified === true;
}

export async function checkRateLimit(chatId: number): Promise<boolean> {
    const ablak = Math.floor(Date.now() / RATE_ABLAK_MS);
    const key = `rate/${chatId}/${ablak}`;
    const rekord = await store().getWithMetadata(key, { type: 'json', consistency: 'strong' });

    if (!rekord) {
        await store().setJSON(key, { count: 1 }, { onlyIfNew: true });
        return true;
    }

    const count = (rekord.data as { count: number }).count ?? 0;
    if (count >= RATE_MAX) return false;

    await store().setJSON(key, { count: count + 1 }, { onlyIfMatch: rekord.etag });
    return true;
}

const ALLAPOT_TTL_MS = 5 * 60 * 1000;

export type BeszelgetesAllapot = { fajta: string; adat: Record<string, string>; lejar: string };

function allapotKey(chatId: number): string {
    return `state/${chatId}`;
}

export async function allapotMent(chatId: number, fajta: string, adat: Record<string, string> = {}): Promise<void> {
    const rekord: BeszelgetesAllapot = { fajta, adat, lejar: new Date(Date.now() + ALLAPOT_TTL_MS).toISOString() };
    await store().setJSON(allapotKey(chatId), rekord);
}

export async function allapotOlvas(chatId: number): Promise<BeszelgetesAllapot | null> {
    const be = (await store().get(allapotKey(chatId), { type: 'json', consistency: 'strong' })) as BeszelgetesAllapot | null;
    if (!be) return null;
    if (be.lejar < new Date().toISOString()) {
        await store().delete(allapotKey(chatId));
        return null;
    }
    return be;
}

export async function allapotTorol(chatId: number): Promise<void> {
    await store().delete(allapotKey(chatId));
}
