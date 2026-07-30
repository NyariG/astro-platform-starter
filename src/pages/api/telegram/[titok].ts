import type { APIRoute } from 'astro';
import { readEnv } from '../../../utils/ajanlat/store';
import { kezelUpdate } from '../../../utils/ajanlat/telegram-router';

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
    const vartPath = readEnv('TELEGRAM_WEBHOOK_PATH');
    if (!vartPath || params.titok !== vartPath) {
        return new Response('Not found', { status: 404 });
    }

    const vartSecret = readEnv('TELEGRAM_WEBHOOK_SECRET');
    if (!vartSecret || request.headers.get('x-telegram-bot-api-secret-token') !== vartSecret) {
        return new Response('Forbidden', { status: 403 });
    }

    let update: unknown;
    try {
        update = await request.json();
    } catch {
        return new Response('Bad request', { status: 400 });
    }

    try {
        await kezelUpdate(update as Parameters<typeof kezelUpdate>[0]);
    } catch (hiba) {
        console.error('[telegram] update feldolgozása sikertelen', { uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
    }

    return new Response('OK', { status: 200 });
};
