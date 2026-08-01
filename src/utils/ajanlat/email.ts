import { altalanosUgyfelLevel, ismeteltKiserletErtesito, lakoepuletUgyfelLevel, ugyfelHibaErtesito, uzemeltetoiAdatlap, type EmailTorzs } from './templates';
import { readEnv, type QuoteRecord } from './store';
import { PDF_FAJLNEV } from './pdf/generate';

const SMTP2GO_ENDPOINT = 'https://api.smtp2go.com/v3/email/send';

type Kornyezet = {
    apiKey: string;
    sender: string;
    replyTo: string;
    notify: string[];
};

class EmailConfigError extends Error {}

function kornyezet(): Kornyezet {
    const apiKey = readEnv('SMTP2GO_API_KEY');
    const sender = readEnv('QUOTE_SENDER_EMAIL');
    const replyTo = sender;
    const notifyRaw = readEnv('QUOTE_NOTIFY_EMAIL');

    const hianyzo: string[] = [];
    if (!apiKey) hianyzo.push('SMTP2GO_API_KEY');
    if (!sender) hianyzo.push('QUOTE_SENDER_EMAIL');
    if (!notifyRaw) hianyzo.push('QUOTE_NOTIFY_EMAIL');

    if (hianyzo.length > 0) {
        throw new EmailConfigError(`Hiányzó környezeti változó: ${hianyzo.join(', ')}`);
    }

    const notify = String(notifyRaw)
        .split(',')
        .map((cim) => cim.trim())
        .filter(Boolean);

    if (notify.length === 0) {
        throw new EmailConfigError('A QUOTE_NOTIFY_EMAIL nem tartalmaz érvényes címet.');
    }

    return { apiKey: String(apiKey), sender: String(sender), replyTo: String(replyTo), notify };
}

/** Egy levélhez csatolható fájl (pl. a generált árajánlat-PDF). */
export type Csatolmany = {
    filename: string;
    /** A fájl bájtjai — küldés előtt base64-re kódoljuk. */
    bytes: Uint8Array;
    mimetype: string;
};

function debugBcc(): string[] {
    const raw = readEnv('DEBUG_EMAIL_TO');
    return raw
        ? String(raw)
              .split(',')
              .map((cim) => cim.trim())
              .filter(Boolean)
        : [];
}

async function kuldes(env: Kornyezet, cimzettek: string[], level: EmailTorzs, csatolmanyok: Csatolmany[] = [], bcc: string[] = []): Promise<void> {
    const attachments = csatolmanyok.map((cs) => ({
        filename: cs.filename,
        fileblob: Buffer.from(cs.bytes).toString('base64'),
        mimetype: cs.mimetype
    }));

    const valasz = await fetch(SMTP2GO_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            accept: 'application/json',
            'X-Smtp2go-Api-Key': env.apiKey
        },
        body: JSON.stringify({
            sender: env.sender,
            to: cimzettek,
            ...(bcc.length > 0 ? { bcc } : {}),
            subject: level.subject,
            html_body: level.html,
            text_body: level.text,
            custom_headers: [{ header: 'Reply-To', value: env.replyTo }],
            ...(attachments.length > 0 ? { attachments } : {})
        })
    });

    if (!valasz.ok) {
        const reszlet = await valasz.text().catch(() => '');
        throw new Error(`SMTP2GO ${valasz.status}: ${reszlet.slice(0, 300)}`);
    }
}

function hibaSzoveg(hiba: unknown): string {
    return hiba instanceof Error ? hiba.message : String(hiba);
}

export type PdfKapcsolo = { pdfAdmin: boolean; pdfUgyfel: boolean };

export async function sikeresBekuldesLevelei(record: QuoteRecord, pdf: Uint8Array | null = null, kapcsolo: PdfKapcsolo = { pdfAdmin: true, pdfUgyfel: true }): Promise<void> {
    const env = kornyezet();
    const bcc = debugBcc();
    const csatolmany = (aktiv: boolean): Csatolmany[] => (pdf && aktiv ? [{ filename: PDF_FAJLNEV, bytes: pdf, mimetype: 'application/pdf' }] : []);
    const adminCsat = csatolmany(kapcsolo.pdfAdmin);
    const ugyfelCsat = csatolmany(kapcsolo.pdfUgyfel);
    const ugyfelLevel = record.ingatlanJelleg === 'lakoepulet' ? lakoepuletUgyfelLevel(record, ugyfelCsat.length > 0) : altalanosUgyfelLevel(record);

    try {
        await kuldes(env, env.notify, uzemeltetoiAdatlap(record), adminCsat, bcc);
    } catch (hiba) {
        console.error('[ajanlat] admin értesítő sikertelen', { id: record.id, uzenet: hibaSzoveg(hiba) });
    }

    try {
        await kuldes(env, [record.email], ugyfelLevel, ugyfelCsat, bcc);
    } catch (hiba) {
        const uzenet = hibaSzoveg(hiba);
        console.error('[ajanlat] ügyfél levél sikertelen', { id: record.id, uzenet });
        try {
            await kuldes(env, env.notify, ugyfelHibaErtesito(record, uzenet), [], bcc);
        } catch (belso) {
            console.error('[ajanlat] admin-riasztás (ügyfél-hiba) sikertelen', { id: record.id, uzenet: hibaSzoveg(belso) });
        }
        throw hiba;
    }
}

/**
 * Napi limit túllépése esetén kizárólag az üzemeltető kap értesítést.
 * Az ügyfélnek szándékosan nem megy semmilyen levél.
 */
export async function ismeteltKiserletLevele(record: QuoteRecord, exactAttempt: boolean): Promise<void> {
    const env = kornyezet();
    await kuldes(env, env.notify, ismeteltKiserletErtesito(record, exactAttempt));
}

/** Az e-mail cím maszkolt alakja naplózáshoz: `n***@gmail.com`. */
export function maszkoltEmail(email: string): string {
    const [nev, domain] = email.split('@');
    if (!domain) return '***';
    return `${nev.slice(0, 1)}***@${domain}`;
}
