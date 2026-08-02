import { answerCallbackQuery, sendMessage, telegramKonfiguralva, type InlineButton } from './telegram';
import { checkRateLimit, consumeLinkToken, isAdmin, linkAdmin, listAdmins, markUpdateProcessed, unlinkAdmin } from './telegram-store';
import { ujAjanlatUzenet } from './telegram-uzenet';
import { adminokMenu, fomenu as adminFomenu, kezelAllapotBemenet, kezelMenuCallback } from './telegram-menu';
import { readEnv, type QuoteRecord } from './store';

type Chat = { id: number };
type From = { id: number; username?: string };
type Message = { message_id: number; from?: From; chat: Chat; text?: string };
type CallbackQuery = { id: string; from: From; message?: { chat: Chat }; data?: string };
type Update = { update_id?: number; message?: Message; callback_query?: CallbackQuery };

const TODO_PARANCSOK = new Set(['/ajanlatok']);

function fomenu(): InlineButton[][] {
    return [
        [
            { text: 'ℹ️ Súgó', callback_data: 'help' },
            { text: '📶 Állapot', callback_data: 'status' }
        ]
    ];
}

function koszonto(linkelt: boolean): string {
    if (linkelt) {
        return 'Üdv újra! A fiókod össze van kötve a Nyári Terv botjával. Válassz az alábbi gombokból, vagy írd be a /help-et.';
    }
    return 'Üdv! Ez a Nyári Terv admin-botja.\n\nA parancsok használatához előbb össze kell kötnöd a fiókodat egy egyszer használatos linkkel. Írd be a /link-et a tudnivalókért.';
}

function helpSzoveg(linkelt: boolean): string {
    const sorok = [
        '<b>Nyári Terv admin-bot — parancsok</b>',
        '',
        '/start — indítás / összekötő link beváltása',
        '/help — ez a súgó',
        '/link — fiók-összekötés tudnivalói',
        '/unlink — fiók leválasztása',
        '/status — a kapcsolat állapota',
        '/admin — vezérlőmenü',
        '/adminok — adminok kezelése (hozzáadás, eltávolítás)'
    ];
    if (!linkelt) {
        sorok.push('', '⛔ A vezérlő parancsok csak összekötött fiókból érhetők el.');
    }
    return sorok.join('\n');
}

async function elutasit(chatId: number): Promise<void> {
    await sendMessage(chatId, '⛔ Ehhez össze kell kötnöd a fiókodat. Írd be a /link-et, vagy nyisd meg az admin által kapott egyszer használatos linket.');
}

export async function kezelUpdate(update: Update): Promise<void> {
    if (typeof update.update_id === 'number') {
        const elso = await markUpdateProcessed(update.update_id);
        if (!elso) return;
    }
    if (update.callback_query) {
        await kezelCallback(update.callback_query);
        return;
    }
    if (update.message?.text) {
        await kezelParancs(update.message);
    }
}

async function kezelParancs(message: Message): Promise<void> {
    const chatId = message.chat.id;
    if (!(await checkRateLimit(chatId))) return;

    const teljesSzoveg = message.text!.trim();
    const [nyers, ...args] = teljesSzoveg.split(/\s+/);
    const parancs = nyers.split('@')[0].toLowerCase();
    const linkelt = await isAdmin(chatId);

    if (linkelt && !teljesSzoveg.startsWith('/')) {
        if (await kezelAllapotBemenet(chatId, teljesSzoveg)) return;
    }

    switch (parancs) {
        case '/start': {
            const token = args[0];
            if (token) {
                const sikeres = await consumeLinkToken(token);
                if (sikeres) {
                    await linkAdmin(chatId, message.from?.username ?? null);
                    await sendMessage(chatId, '✅ Sikeresen összekötöttük a fiókodat a Nyári Terv botjával. Írd be a /help-et a parancsokért.', { keyboard: fomenu() });
                } else {
                    await sendMessage(chatId, '⚠️ Ez az összekötő link érvénytelen vagy lejárt (10 percig, egyszer használható). Kérj újat az adminfelületről.');
                }
                return;
            }
            await sendMessage(chatId, koszonto(linkelt), { keyboard: linkelt ? fomenu() : undefined });
            return;
        }
        case '/help':
            await sendMessage(chatId, helpSzoveg(linkelt), { keyboard: linkelt ? fomenu() : undefined });
            return;
        case '/link':
            if (linkelt) {
                await sendMessage(chatId, 'Ez a fiók már össze van kötve. A leválasztáshoz használd az /unlink-et.', { keyboard: fomenu() });
                return;
            }
            await sendMessage(chatId, 'Az összekötéshez nyisd meg az adminfelületről kapott egyszer használatos linket (<code>t.me/&lt;bot&gt;?start=TOKEN</code>), vagy írd be: <code>/start &lt;token&gt;</code>');
            return;
        case '/unlink':
            if (!linkelt) return elutasit(chatId);
            await unlinkAdmin(chatId);
            await sendMessage(chatId, '🔌 Leválasztottuk ezt a fiókot. A parancsok addig nem elérhetők, amíg újra össze nem kötöd.');
            return;
        case '/status': {
            if (!linkelt) return elutasit(chatId);
            const darab = (await listAdmins()).length;
            await sendMessage(chatId, `🟢 <b>Összekötve.</b>\nChat azonosító: <code>${chatId}</code>\nÖsszekötött adminok: <b>${darab}</b>`, { keyboard: fomenu() });
            return;
        }
        case '/admin':
        case '/menu':
            if (!linkelt) return elutasit(chatId);
            await adminFomenu(chatId);
            return;
        case '/adminok':
            if (!linkelt) return elutasit(chatId);
            await adminokMenu(chatId);
            return;
        default:
            if (TODO_PARANCSOK.has(parancs)) {
                if (!linkelt) return elutasit(chatId);
                await sendMessage(chatId, '🚧 Ez a vezérlő funkció a következő iterációban érkezik.');
                return;
            }
            await sendMessage(chatId, 'Ismeretlen parancs. Írd be a /help-et.', { keyboard: linkelt ? fomenu() : undefined });
    }
}

async function kezelCallback(cq: CallbackQuery): Promise<void> {
    await answerCallbackQuery(cq.id);
    const chatId = cq.message?.chat.id ?? cq.from.id;
    if (!(await isAdmin(chatId))) {
        await elutasit(chatId);
        return;
    }
    if (cq.data && (await kezelMenuCallback(chatId, cq.data))) return;
    switch (cq.data) {
        case 'help':
            await sendMessage(chatId, helpSzoveg(true), { keyboard: fomenu() });
            return;
        case 'status': {
            const darab = (await listAdmins()).length;
            await sendMessage(chatId, `🟢 <b>Összekötve.</b>\nChat azonosító: <code>${chatId}</code>\nÖsszekötött adminok: <b>${darab}</b>`, { keyboard: fomenu() });
            return;
        }
        default:
            await sendMessage(chatId, 'Ismeretlen művelet.', { keyboard: fomenu() });
    }
}

export async function ertesitsUjAjanlat(record: QuoteRecord): Promise<void> {
    if (!telegramKonfiguralva()) return;
    const adminok = await listAdmins();
    if (adminok.length === 0) return;

    const baseUrl = readEnv('URL') ?? 'https://nyariterv.hu';
    const { szoveg, keyboard } = ujAjanlatUzenet(record, { baseUrl });

    for (const admin of adminok) {
        try {
            await sendMessage(admin.chatId, szoveg, keyboard ? { keyboard } : {});
        } catch (hiba) {
            console.error('[telegram] admin-értesítés sikertelen', { chatId: admin.chatId, uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
        }
    }
}

export async function ertesitsMegtekintes(record: QuoteRecord): Promise<void> {
    if (!telegramKonfiguralva()) return;
    const adminok = await listAdmins();
    if (adminok.length === 0) return;
    const szoveg = `👁️ <b>Az ügyfél megnyitotta az ajánlatot</b>\n${record.nev} · #${record.id.slice(0, 8)}`;
    for (const admin of adminok) {
        try {
            await sendMessage(admin.chatId, szoveg);
        } catch (hiba) {
            console.error('[telegram] megtekintés-értesítés sikertelen', { chatId: admin.chatId, uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
        }
    }
}
