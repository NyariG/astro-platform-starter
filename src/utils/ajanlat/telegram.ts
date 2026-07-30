import { readEnv } from './store';

const API_BASE = 'https://api.telegram.org';
const PROBAK = 3;

export type InlineButton = { text: string; callback_data?: string; url?: string };
export type SendOpts = { keyboard?: InlineButton[][]; parseMode?: 'HTML' | 'Markdown' };

function botToken(): string | null {
    return readEnv('TELEGRAM_BOT_TOKEN') ?? null;
}

export function telegramKonfiguralva(): boolean {
    return Boolean(botToken());
}

async function hivas(metodus: string, body: Record<string, unknown>): Promise<unknown> {
    const token = botToken();
    if (!token) throw new Error('Hiányzó TELEGRAM_BOT_TOKEN');

    let utolsoHiba: unknown = null;
    for (let proba = 0; proba < PROBAK; proba++) {
        try {
            const valasz = await fetch(`${API_BASE}/bot${token}/${metodus}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const json = (await valasz.json().catch(() => null)) as { ok?: boolean; result?: unknown; description?: string } | null;
            if (valasz.ok && json?.ok) return json.result;
            utolsoHiba = new Error(`Telegram ${metodus} ${valasz.status}: ${json?.description ?? 'ismeretlen hiba'}`);
            if (valasz.status >= 400 && valasz.status < 500 && valasz.status !== 429) break;
        } catch (hiba) {
            utolsoHiba = hiba;
        }
        await new Promise((resolve) => setTimeout(resolve, 300 * (proba + 1)));
    }
    throw utolsoHiba instanceof Error ? utolsoHiba : new Error(String(utolsoHiba));
}

export async function sendMessage(chatId: number | string, szoveg: string, opts: SendOpts = {}): Promise<void> {
    const body: Record<string, unknown> = {
        chat_id: chatId,
        text: szoveg,
        parse_mode: opts.parseMode ?? 'HTML',
        disable_web_page_preview: true
    };
    if (opts.keyboard && opts.keyboard.length > 0) {
        body.reply_markup = { inline_keyboard: opts.keyboard };
    }
    await hivas('sendMessage', body);
}

export async function answerCallbackQuery(callbackQueryId: string, szoveg?: string): Promise<void> {
    await hivas('answerCallbackQuery', { callback_query_id: callbackQueryId, ...(szoveg ? { text: szoveg } : {}) });
}
