import nodemailer from 'nodemailer';
import { readEnv } from './store';
import type { EmailTorzs } from './templates';
import type { Csatolmany } from './email';

export async function gmailKuldes(cimzettek: string[], level: EmailTorzs, csatolmanyok: Csatolmany[] = []): Promise<void> {
    const sender = readEnv('GMAIL_SENDER');
    const jelszo = readEnv('GMAIL_APP_PASSWORD');
    if (!sender || !jelszo) {
        throw new Error('Hiányzó Gmail környezeti változó: GMAIL_SENDER és/vagy GMAIL_APP_PASSWORD');
    }

    const replyTo = readEnv('QUOTE_REPLY_TO') || sender;
    const transport = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user: sender, pass: jelszo }
    });

    await transport.sendMail({
        from: sender,
        to: cimzettek,
        replyTo,
        subject: level.subject,
        html: level.html,
        text: level.text,
        attachments: csatolmanyok.map((cs) => ({
            filename: cs.filename,
            content: Buffer.from(cs.bytes),
            contentType: cs.mimetype
        }))
    });
}
