import type { APIRoute } from 'astro';
import { futtatKarbantartast } from '../../utils/ajanlat/karbantartas';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    if (!import.meta.env.DEV && !url.searchParams.has('debug')) {
        return new Response('Not found', { status: 404 });
    }
    const eredmeny = await futtatKarbantartast();
    return new Response(JSON.stringify({ ok: true, ...eredmeny }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
};
