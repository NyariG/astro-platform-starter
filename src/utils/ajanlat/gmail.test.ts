import { describe, expect, it, vi, beforeEach } from 'vitest';

const { createTransport, sendMail, readEnv } = vi.hoisted(() => {
    const sendMail = vi.fn();
    const createTransport = vi.fn(() => ({ sendMail }));
    const readEnv = vi.fn();
    return { createTransport, sendMail, readEnv };
});
vi.mock('nodemailer', () => ({ default: { createTransport } }));
vi.mock('./store', () => ({ readEnv }));

import { gmailKuldes } from './gmail';

const level = { subject: 'Árajánlatkérését rögzítettük', html: '<p>Kedves Anna!</p>', text: 'Kedves Anna!' };

describe('gmailKuldes', () => {
    beforeEach(() => {
        sendMail.mockClear();
        createTransport.mockClear();
        readEnv.mockReset();
    });

    it('hiányzó Gmail env esetén hibát dob, nem próbál küldeni', async () => {
        readEnv.mockReturnValue(undefined);
        await expect(gmailKuldes(['a@b.hu'], level)).rejects.toThrow(/GMAIL_SENDER/);
        expect(createTransport).not.toHaveBeenCalled();
    });

    it('smtp.gmail.com:587 STARTTLS transportot hoz létre a megadott auth-tal', async () => {
        readEnv.mockImplementation((k: string) => ({ GMAIL_SENDER: 'ajanlat@nyariterv.hu', GMAIL_APP_PASSWORD: 'titok', QUOTE_REPLY_TO: 'info@nyariterv.hu' })[k]);
        await gmailKuldes(['ugyfel@x.hu'], level);
        expect(createTransport).toHaveBeenCalledWith({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: { user: 'ajanlat@nyariterv.hu', pass: 'titok' }
        });
    });

    it('a levelet a feladóval, reply-to-val és a PDF melléklettel küldi', async () => {
        readEnv.mockImplementation((k: string) => ({ GMAIL_SENDER: 'ajanlat@nyariterv.hu', GMAIL_APP_PASSWORD: 'titok', QUOTE_REPLY_TO: 'info@nyariterv.hu' })[k]);
        await gmailKuldes(['ugyfel@x.hu'], level, [{ filename: 'arajanlat.pdf', bytes: new Uint8Array([37, 80, 68, 70]), mimetype: 'application/pdf' }]);
        const arg = sendMail.mock.calls[0][0];
        expect(arg.from).toBe('ajanlat@nyariterv.hu');
        expect(arg.to).toEqual(['ugyfel@x.hu']);
        expect(arg.replyTo).toBe('info@nyariterv.hu');
        expect(arg.subject).toBe('Árajánlatkérését rögzítettük');
        expect(arg.attachments).toHaveLength(1);
        expect(arg.attachments[0].filename).toBe('arajanlat.pdf');
        expect(arg.attachments[0].contentType).toBe('application/pdf');
        expect(Buffer.isBuffer(arg.attachments[0].content)).toBe(true);
    });

    it('reply-to hiányában a feladó címre esik vissza', async () => {
        readEnv.mockImplementation((k: string) => ({ GMAIL_SENDER: 'ajanlat@nyariterv.hu', GMAIL_APP_PASSWORD: 'titok' })[k]);
        await gmailKuldes(['ugyfel@x.hu'], level);
        expect(sendMail.mock.calls[0][0].replyTo).toBe('ajanlat@nyariterv.hu');
    });
});
