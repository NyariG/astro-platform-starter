import type { APIRoute } from 'astro';
import { getMarkaKep, readEnv, saveMarkaKep, type MarkaKep } from '../../utils/ajanlat/store';

export const prerender = false;

function markaKepNev(url: URL): MarkaKep | null {
    const nev = url.searchParams.get('nev');
    return nev === 'banner' || nev === 'ikonok' ? nev : null;
}

function seedEngedelyezett(request: Request): boolean {
    if (import.meta.env.DEV) return true;
    const token = readEnv('SABLON_SEED_TOKEN');
    if (!token) return false;
    return request.headers.get('authorization') === `Bearer ${token}`;
}

export const GET: APIRoute = async ({ url }) => {
    const nev = markaKepNev(url);
    if (!nev) return new Response('A nev paraméter kötelező: banner | ikonok.', { status: 400 });
    const kep = await getMarkaKep(nev);
    if (!kep) return new Response('Not found', { status: 404 });
    return new Response(kep, {
        status: 200,
        headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' }
    });
};

export const POST: APIRoute = async ({ request, url }) => {
    if (!seedEngedelyezett(request)) return new Response('Not found', { status: 404 });
    const nev = markaKepNev(url);
    if (!nev) return new Response('A nev paraméter kötelező: banner | ikonok.', { status: 400 });
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length === 0) return new Response('Üres törzs.', { status: 422 });
    await saveMarkaKep(nev, bytes);
    return new Response(JSON.stringify({ ok: true, nev, meret: bytes.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};
