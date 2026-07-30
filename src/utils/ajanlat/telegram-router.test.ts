import { describe, expect, it, vi, beforeEach } from 'vitest';

const svc = vi.hoisted(() => ({
    sendMessage: vi.fn(async (_chatId: number, _szoveg: string, _opts?: unknown) => {}),
    answerCallbackQuery: vi.fn(async (_id: string, _szoveg?: string) => {}),
    telegramKonfiguralva: vi.fn(() => true)
}));
const store = vi.hoisted(() => ({
    markUpdateProcessed: vi.fn(async () => true),
    checkRateLimit: vi.fn(async () => true),
    isAdmin: vi.fn(async () => false),
    consumeLinkToken: vi.fn(async () => false),
    linkAdmin: vi.fn(async () => {}),
    unlinkAdmin: vi.fn(async () => {}),
    listAdmins: vi.fn(async () => [])
}));

vi.mock('./telegram', () => svc);
vi.mock('./telegram-store', () => store);

import { ertesitsUjAjanlat, kezelUpdate } from './telegram-router';

function msg(text: string, chatId = 100, username = 'admin') {
    return { message: { message_id: 1, from: { id: chatId, username }, chat: { id: chatId }, text } };
}

beforeEach(() => {
    vi.clearAllMocks();
    svc.telegramKonfiguralva.mockReturnValue(true);
    store.markUpdateProcessed.mockResolvedValue(true);
    store.checkRateLimit.mockResolvedValue(true);
    store.isAdmin.mockResolvedValue(false);
    store.consumeLinkToken.mockResolvedValue(false);
    store.listAdmins.mockResolvedValue([]);
});

describe('kezelUpdate — idempotencia és rate-limit', () => {
    it('duplikált update-et kihagy (nincs válasz)', async () => {
        store.markUpdateProcessed.mockResolvedValue(false);
        await kezelUpdate({ update_id: 7, ...msg('/help') });
        expect(svc.sendMessage).not.toHaveBeenCalled();
    });

    it('rate-limit túllépésekor nem válaszol', async () => {
        store.checkRateLimit.mockResolvedValue(false);
        await kezelUpdate(msg('/help'));
        expect(svc.sendMessage).not.toHaveBeenCalled();
    });
});

describe('parancsok — auth', () => {
    it('/status összekötés nélkül elutasít', async () => {
        store.isAdmin.mockResolvedValue(false);
        await kezelUpdate(msg('/status'));
        expect(svc.sendMessage).toHaveBeenCalledTimes(1);
        expect(svc.sendMessage.mock.calls[0][1]).toMatch(/össze kell kötnöd/);
    });

    it('/status összekötve az állapotot mutatja', async () => {
        store.isAdmin.mockResolvedValue(true);
        store.listAdmins.mockResolvedValue([{ chatId: 100, username: 'a', linkedAt: 'x' }]);
        await kezelUpdate(msg('/status'));
        expect(svc.sendMessage.mock.calls[0][1]).toMatch(/Összekötve/);
    });

    it('/unlink összekötve leválaszt', async () => {
        store.isAdmin.mockResolvedValue(true);
        await kezelUpdate(msg('/unlink'));
        expect(store.unlinkAdmin).toHaveBeenCalledWith(100);
        expect(svc.sendMessage.mock.calls[0][1]).toMatch(/Leválasztottuk/);
    });
});

describe('/start token-beváltás', () => {
    it('érvényes token összeköti az admint', async () => {
        store.consumeLinkToken.mockResolvedValue(true);
        await kezelUpdate(msg('/start abc123'));
        expect(store.consumeLinkToken).toHaveBeenCalledWith('abc123');
        expect(store.linkAdmin).toHaveBeenCalledWith(100, 'admin');
        expect(svc.sendMessage.mock.calls[0][1]).toMatch(/Sikeresen összekötöttük/);
    });

    it('érvénytelen token nem köt össze', async () => {
        store.consumeLinkToken.mockResolvedValue(false);
        await kezelUpdate(msg('/start rossz'));
        expect(store.linkAdmin).not.toHaveBeenCalled();
        expect(svc.sendMessage.mock.calls[0][1]).toMatch(/érvénytelen vagy lejárt/);
    });

    it('token nélküli /start köszönt', async () => {
        await kezelUpdate(msg('/start'));
        expect(store.consumeLinkToken).not.toHaveBeenCalled();
        expect(svc.sendMessage).toHaveBeenCalledTimes(1);
    });
});

describe('ismeretlen parancs', () => {
    it('/help-re irányít', async () => {
        await kezelUpdate(msg('/valami'));
        expect(svc.sendMessage.mock.calls[0][1]).toMatch(/Ismeretlen parancs/);
    });
});

describe('callback query', () => {
    it('összekötés nélkül elutasít, de nyugtáz', async () => {
        store.isAdmin.mockResolvedValue(false);
        await kezelUpdate({ callback_query: { id: 'cq', from: { id: 100 }, message: { chat: { id: 100 } }, data: 'status' } });
        expect(svc.answerCallbackQuery).toHaveBeenCalledWith('cq');
        expect(svc.sendMessage.mock.calls[0][1]).toMatch(/össze kell kötnöd/);
    });

    it('összekötve a status gomb az állapotot adja', async () => {
        store.isAdmin.mockResolvedValue(true);
        store.listAdmins.mockResolvedValue([{ chatId: 100, username: 'a', linkedAt: 'x' }]);
        await kezelUpdate({ callback_query: { id: 'cq', from: { id: 100 }, message: { chat: { id: 100 } }, data: 'status' } });
        expect(svc.sendMessage.mock.calls[0][1]).toMatch(/Összekötve/);
    });
});

describe('ertesitsUjAjanlat — best-effort', () => {
    const rekord = {
        nev: 'Kab Bea',
        email: 'bea@example.com',
        telefon: '+36 30 111 2222',
        varos: 'Győr',
        ingatlanJelleg: 'lakoepulet',
        szolgaltatasok: ['futes'],
        vegosszeg: 1234000,
        vanEgyediArazas: false
    } as unknown as Parameters<typeof ertesitsUjAjanlat>[0];

    it('nincs konfiguráció → nem küld', async () => {
        svc.telegramKonfiguralva.mockReturnValue(false);
        await ertesitsUjAjanlat(rekord);
        expect(svc.sendMessage).not.toHaveBeenCalled();
    });

    it('nincs admin → nem küld', async () => {
        store.listAdmins.mockResolvedValue([]);
        await ertesitsUjAjanlat(rekord);
        expect(svc.sendMessage).not.toHaveBeenCalled();
    });

    it('minden összekötött adminnak küld', async () => {
        store.listAdmins.mockResolvedValue([
            { chatId: 100, username: 'a', linkedAt: 'x' },
            { chatId: 200, username: 'b', linkedAt: 'y' }
        ]);
        await ertesitsUjAjanlat(rekord);
        expect(svc.sendMessage).toHaveBeenCalledTimes(2);
        expect(svc.sendMessage.mock.calls[0][1]).toMatch(/Kab Bea/);
    });

    it('egy admin hibája nem állítja meg a többit', async () => {
        store.listAdmins.mockResolvedValue([
            { chatId: 100, username: 'a', linkedAt: 'x' },
            { chatId: 200, username: 'b', linkedAt: 'y' }
        ]);
        svc.sendMessage.mockRejectedValueOnce(new Error('hiba'));
        await ertesitsUjAjanlat(rekord);
        expect(svc.sendMessage).toHaveBeenCalledTimes(2);
    });
});
