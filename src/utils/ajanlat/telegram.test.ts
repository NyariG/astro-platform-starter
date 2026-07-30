import { describe, expect, it, vi, beforeEach } from 'vitest';

const { readEnv } = vi.hoisted(() => ({ readEnv: vi.fn() }));
vi.mock('./store', () => ({ readEnv }));

import { answerCallbackQuery, sendMessage, telegramKonfiguralva } from './telegram';

function valasz(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('TelegramService', () => {
    beforeEach(() => {
        readEnv.mockReset();
        vi.restoreAllMocks();
    });

    it('token nélkül hibát dob, és nem hív fetchet', async () => {
        readEnv.mockReturnValue(undefined);
        const f = vi.spyOn(globalThis, 'fetch');
        await expect(sendMessage(123, 'x')).rejects.toThrow(/TELEGRAM_BOT_TOKEN/);
        expect(f).not.toHaveBeenCalled();
        expect(telegramKonfiguralva()).toBe(false);
    });

    it('sendMessage a helyes végpontra, HTML-lel és inline keyboarddal küld', async () => {
        readEnv.mockReturnValue('BOT:TOKEN');
        const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(valasz({ ok: true, result: {} }));
        await sendMessage(555, 'Szia', { keyboard: [[{ text: 'A', callback_data: 'a' }]] });
        expect(f).toHaveBeenCalledTimes(1);
        const [url, opts] = f.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://api.telegram.org/botBOT:TOKEN/sendMessage');
        const body = JSON.parse(String(opts.body));
        expect(body.chat_id).toBe(555);
        expect(body.text).toBe('Szia');
        expect(body.parse_mode).toBe('HTML');
        expect(body.reply_markup).toEqual({ inline_keyboard: [[{ text: 'A', callback_data: 'a' }]] });
    });

    it('4xx (nem 429) hibánál azonnal dob, nem próbálkozik újra', async () => {
        readEnv.mockReturnValue('BOT:TOKEN');
        const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(valasz({ ok: false, description: 'Bad Request' }, 400));
        await expect(sendMessage(1, 'x')).rejects.toThrow(/400/);
        expect(f).toHaveBeenCalledTimes(1);
    });

    it('answerCallbackQuery a callback_query_id-t küldi', async () => {
        readEnv.mockReturnValue('BOT:TOKEN');
        const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(valasz({ ok: true, result: true }));
        await answerCallbackQuery('cbq1', 'ok');
        const [url, opts] = f.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('/answerCallbackQuery');
        const body = JSON.parse(String(opts.body));
        expect(body.callback_query_id).toBe('cbq1');
        expect(body.text).toBe('ok');
    });
});
