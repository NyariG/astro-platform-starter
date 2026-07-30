import type { APIRoute } from 'astro';
import { readEnv } from '../../utils/ajanlat/store';

export const prerender = false;

function jelenlet(nev: string): string {
    const ertek = readEnv(nev);
    return ertek ? `beállítva (${String(ertek).length} kar.)` : '(nincs)';
}

export const GET: APIRoute = async ({ url }) => {
    if (!import.meta.env.DEV && !url.searchParams.has('debug')) {
        return new Response('Not found', { status: 404 });
    }

    const cfg = {
        SMTP2GO_API_KEY: jelenlet('SMTP2GO_API_KEY'),
        QUOTE_SENDER_EMAIL: readEnv('QUOTE_SENDER_EMAIL') ?? '(nincs)',
        QUOTE_REPLY_TO: readEnv('QUOTE_REPLY_TO') ?? '(nincs)',
        QUOTE_NOTIFY_EMAIL: readEnv('QUOTE_NOTIFY_EMAIL') ?? '(nincs)',
        DEBUG_EMAIL_TO: readEnv('DEBUG_EMAIL_TO') ?? '(nincs)'
    };

    let testSend: unknown = 'kihagyva (add hozzá: &send=1)';
    if (url.searchParams.get('send') === '1') {
        const apiKey = readEnv('SMTP2GO_API_KEY');
        const sender = readEnv('QUOTE_SENDER_EMAIL');
        const notify = String(readEnv('QUOTE_NOTIFY_EMAIL') ?? '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (!apiKey || !sender || notify.length === 0) {
            testSend = { hiba: 'hiányzó env a teszthez', apiKey: Boolean(apiKey), sender: Boolean(sender), notify: notify.length };
        } else {
            try {
                const valasz = await fetch('https://api.smtp2go.com/v3/email/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', accept: 'application/json', 'X-Smtp2go-Api-Key': String(apiKey) },
                    body: JSON.stringify({ sender: String(sender), to: notify, subject: 'Nyári Terv — email diagnosztika', text_body: 'Diagnosztikai teszt.' })
                });
                const body = await valasz.text().catch(() => '');
                testSend = { status: valasz.status, ok: valasz.ok, body: body.slice(0, 800) };
            } catch (hiba) {
                testSend = { kivetel: hiba instanceof Error ? hiba.message : String(hiba) };
            }
        }
    }

    return new Response(JSON.stringify({ cfg, testSend }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
};
