import type { APIRoute } from 'astro';
import { betoltKapcsolok } from '../../utils/ajanlat/admin-config';

export const prerender = false;

export const GET: APIRoute = async () => {
    let debug = false;
    try {
        debug = (await betoltKapcsolok()).debug === true;
    } catch {
        debug = false;
    }
    return new Response(JSON.stringify({ debug }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
};
