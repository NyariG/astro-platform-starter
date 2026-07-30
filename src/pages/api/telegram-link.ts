import type { APIRoute } from 'astro';
import { readEnv } from '../../utils/ajanlat/store';
import { createLinkToken } from '../../utils/ajanlat/telegram-store';

export const prerender = false;

function engedelyezett(request: Request): boolean {
    if (import.meta.env.DEV) return true;
    const token = readEnv('SABLON_SEED_TOKEN');
    return Boolean(token) && request.headers.get('authorization') === `Bearer ${token}`;
}

function ujToken(): string {
    const bajtok = new Uint8Array(24);
    crypto.getRandomValues(bajtok);
    return Array.from(bajtok, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const POST: APIRoute = async ({ request }) => {
    if (!engedelyezett(request)) {
        return new Response('Not found', { status: 404 });
    }

    const token = ujToken();
    await createLinkToken(token);

    const botNev = readEnv('TELEGRAM_BOT_USERNAME');
    const link = botNev ? `https://t.me/${botNev}?start=${token}` : null;

    return new Response(JSON.stringify({ ok: true, token, link, parancs: `/start ${token}`, ttl_perc: 10 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
};
