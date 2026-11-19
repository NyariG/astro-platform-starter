import { getStore } from '@netlify/blobs';
import { readEnv } from '../ajanlat/store';
import { sendMessage, telegramKonfiguralva } from '../ajanlat/telegram';
import { listAdmins } from '../ajanlat/telegram-store';
import type { Level } from './uzenetek';

const SMTP2GO_ENDPOINT = 'https://api.smtp2go.com/v3/email/send';
const NAPI_IP_LIMIT = 5;

export async function emailKuldes(cimzettek: string[], level: Level, valaszCim?: string): Promise<void> {
    const apiKey = readEnv('SMTP2GO_API_KEY');
    const felado = readEnv('TANUSITVANY_SENDER_EMAIL') ?? readEnv('QUOTE_SENDER_EMAIL');
    if (!apiKey || !felado) throw new Error('Hiányzó környezeti változó: SMTP2GO_API_KEY vagy QUOTE_SENDER_EMAIL');

    const valasz = await fetch(SMTP2GO_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accept: 'application/json', 'X-Smtp2go-Api-Key': apiKey },
        body: JSON.stringify({
            sender: felado,
            to: cimzettek,
            subject: level.subject,
            html_body: level.html,
            text_body: level.text,
            custom_headers: [{ header: 'Reply-To', value: valaszCim ?? felado }]
        })
    });
    if (!valasz.ok) {
        const reszlet = await valasz.text().catch(() => '');
        throw new Error(`SMTP2GO ${valasz.status}: ${reszlet.slice(0, 300)}`);
    }
}

export function ertesitesiCimek(): string[] {
    const nyers = readEnv('TANUSITVANY_NOTIFY_EMAIL') ?? 'tanusitvany@nyariterv.hu';
    return nyers
        .split(',')
        .map((cim) => cim.trim())
        .filter(Boolean);
}

export async function telegramErtesites(szoveg: string): Promise<number> {
    if (!telegramKonfiguralva()) return 0;
    const adminok = await listAdmins();
    let sikeres = 0;
    for (const admin of adminok) {
        try {
            await sendMessage(admin.chatId, szoveg, { parseMode: 'HTML' });
            sikeres++;
        } catch (hiba) {
            console.error('[tanusitvany] telegram-értesítés sikertelen', { chatId: admin.chatId, uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
        }
    }
    return sikeres;
}

async function regiKeretekTorlese(tar: ReturnType<typeof getStore>, mai: string): Promise<void> {
    try {
        const { blobs } = await tar.list({ prefix: 'ip/' });
        await Promise.all(blobs.filter((b) => b.key.split('/')[1] < mai).map((b) => tar.delete(b.key)));
    } catch (hiba) {
        console.error('[tanusitvany] régi IP-keretek törlése sikertelen', hiba instanceof Error ? hiba.message : String(hiba));
    }
}

export async function ipKeretFoglalas(ipHash: string, datum: string): Promise<boolean> {
    try {
        const tar = getStore({ name: 'tanusitvany', consistency: 'strong' });
        await regiKeretekTorlese(tar, datum);
        const kulcs = `ip/${datum}/${ipHash}`;
        for (let i = 0; i < 3; i++) {
            const jelenlegi = await tar.getWithMetadata(kulcs, { type: 'json', consistency: 'strong' });
            if (!jelenlegi) {
                if ((await tar.setJSON(kulcs, { db: 1 }, { onlyIfNew: true })).modified) return true;
                continue;
            }
            const db = (jelenlegi.data as { db?: number })?.db ?? 0;
            if (db >= NAPI_IP_LIMIT) return false;
            if ((await tar.setJSON(kulcs, { db: db + 1 }, { onlyIfMatch: jelenlegi.etag })).modified) return true;
        }
        return true;
    } catch (hiba) {
        console.error('[tanusitvany] IP-keret nem ellenőrizhető', hiba instanceof Error ? hiba.message : String(hiba));
        return true;
    }
}
