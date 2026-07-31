import { getStore } from '@netlify/blobs';

const STORE_NAME = 'beallitasok';

function store() {
    return getStore({ name: STORE_NAME, consistency: 'strong' });
}

export type VerzioMeta = {
    verzio: number;
    modositotta: string;
    mikor: string;
    mit: string;
};

export type Verziozott<T> = {
    adat: T;
    meta: VerzioMeta;
};

function most(): string {
    return new Date().toISOString();
}

function historyKulcs(kulcs: string, verzio: number): string {
    return `${kulcs}__history__${verzio}`;
}

export async function olvasKonfig<T>(kulcs: string, seed: T): Promise<T> {
    const be = (await store().get(kulcs, { type: 'json', consistency: 'strong' })) as Verziozott<T> | null;
    if (be && be.adat !== undefined && be.adat !== null) return be.adat;

    const kezdo: Verziozott<T> = { adat: seed, meta: { verzio: 1, modositotta: 'seed', mikor: most(), mit: 'kezdeti seed' } };
    const eredmeny = await store().setJSON(kulcs, kezdo, { onlyIfNew: true });
    if (eredmeny.modified) await store().setJSON(historyKulcs(kulcs, 1), kezdo);
    return seed;
}

export async function irKonfig<T>(kulcs: string, adat: T, modositotta: string, mit: string): Promise<VerzioMeta> {
    const jelenlegi = await store().getWithMetadata(kulcs, { type: 'json', consistency: 'strong' });
    const elozo = jelenlegi?.data as Verziozott<T> | undefined;
    const meta: VerzioMeta = { verzio: (elozo?.meta.verzio ?? 0) + 1, modositotta, mikor: most(), mit };
    const uj: Verziozott<T> = { adat, meta };

    if (jelenlegi?.etag) {
        const eredmeny = await store().setJSON(kulcs, uj, { onlyIfMatch: jelenlegi.etag });
        if (!eredmeny.modified) throw new Error('Időközben más módosította a beállítást — kérlek próbáld újra.');
    } else {
        const eredmeny = await store().setJSON(kulcs, uj, { onlyIfNew: true });
        if (!eredmeny.modified) throw new Error('Időközben más módosította a beállítást — kérlek próbáld újra.');
    }

    await store().setJSON(historyKulcs(kulcs, meta.verzio), uj);
    return meta;
}

export async function konfigMeta(kulcs: string): Promise<VerzioMeta | null> {
    const be = (await store().get(kulcs, { type: 'json', consistency: 'strong' })) as Verziozott<unknown> | null;
    return be?.meta ?? null;
}

export async function verzioLista(kulcs: string, limit = 10): Promise<VerzioMeta[]> {
    const meta = await konfigMeta(kulcs);
    if (!meta) return [];
    const eredmeny: VerzioMeta[] = [];
    for (let v = meta.verzio; v >= 1 && eredmeny.length < limit; v--) {
        const be = (await store().get(historyKulcs(kulcs, v), { type: 'json', consistency: 'strong' })) as Verziozott<unknown> | null;
        if (be?.meta) eredmeny.push(be.meta);
    }
    return eredmeny;
}

export async function visszaallit<T>(kulcs: string, verzio: number, modositotta: string): Promise<T> {
    const be = (await store().get(historyKulcs(kulcs, verzio), { type: 'json', consistency: 'strong' })) as Verziozott<T> | null;
    if (!be) throw new Error(`Nincs ilyen verzió: ${verzio}`);
    await irKonfig(kulcs, be.adat, modositotta, `visszaállítás a(z) ${verzio}. verzióra`);
    return be.adat;
}
