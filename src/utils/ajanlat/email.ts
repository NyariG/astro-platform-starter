import { altalanosUgyfelLevel, ismeteltKiserletErtesito, lakoepuletUgyfelLevel, uzemeltetoiAdatlap, type EmailTorzs } from './templates';
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
    const replyTo = readEnv('QUOTE_REPLY_TO');
    const notifyRaw = readEnv('QUOTE_NOTIFY_EMAIL');

    const hianyzo: string[] = [];
    if (!apiKey) hianyzo.push('SMTP2GO_API_KEY');
    if (!sender) hianyzo.push('QUOTE_SENDER_EMAIL');
    if (!replyTo) hianyzo.push('QUOTE_REPLY_TO');
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

async function kuldes(env: Kornyezet, cimzettek: string[], level: EmailTorzs, csatolmanyok: Csatolmany[] = []): Promise<void> {
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

export async function sikeresBekuldesLevelei(record: QuoteRecord, pdf: Uint8Array | null = null): Promise<void> {
    const env = kornyezet();
    const ugyfelLevel = record.ingatlanJelleg === 'lakoepulet' ? lakoepuletUgyfelLevel(record) : altalanosUgyfelLevel(record);
    const csatolmanyok: Csatolmany[] = pdf ? [{ filename: PDF_FAJLNEV, bytes: pdf, mimetype: 'application/pdf' }] : [];

    await kuldes(env, env.notify, uzemeltetoiAdatlap(record), csatolmanyok);
    await kuldes(env, [record.email], ugyfelLevel, csatolmanyok);
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
