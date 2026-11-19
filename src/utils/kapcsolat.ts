import { z } from 'zod';
import { readEnv } from './ajanlat/store';
import { html, type Level } from './tanusitvany/uzenetek';

export const kapcsolatSema = z.object({
    nev: z.string().trim().min(2, 'Adja meg a nevét.').max(100, 'Túl hosszú név.'),
    telefon: z
        .string()
        .trim()
        .max(20)
        .refine((t) => t === '' || /^\+?[0-9 ()/-]{8,20}$/.test(t), 'Adjon meg érvényes telefonszámot.')
        .default(''),
    email: z.string().trim().email('Adjon meg érvényes e-mail-címet.').max(200),
    uzenet: z.string().trim().min(5, 'Írja le röviden, miben segíthetünk.').max(5000, 'Legfeljebb 5000 karakter.'),
    adatkezeles: z.literal(true, { errorMap: () => ({ message: 'Az adatkezelési tájékoztató elfogadása szükséges.' }) }),
    weboldal: z.string().max(0).optional().default('')
});

export type KapcsolatUzenet = z.infer<typeof kapcsolatSema>;

export function kapcsolatCimzettek(): string[] {
    return (readEnv('KAPCSOLAT_NOTIFY_EMAIL') ?? 'info@nyariterv.hu')
        .split(',')
        .map((cim) => cim.trim())
        .filter(Boolean);
}

export function kapcsolatLevel(adat: KapcsolatUzenet, oldal: string): Level {
    const sorok: [string, string][] = [
        ['Név', adat.nev],
        ['E-mail', adat.email],
        ['Telefon', adat.telefon || '–'],
        ['Oldal', oldal]
    ];
    const tabla = sorok.map(([k, v]) => `<tr><td style="color:#64748b;padding:4px 12px 4px 0">${html(k)}</td><td><b>${html(v)}</b></td></tr>`).join('');
    return {
        subject: `Üzenet a weboldalról: ${adat.nev}`,
        html: `<div style="font-family:Arial,sans-serif;font-size:14px"><table>${tabla}</table><p style="white-space:pre-wrap;border-left:3px solid #2563eb;padding-left:12px">${html(adat.uzenet)}</p></div>`,
        text: `${sorok.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${adat.uzenet}`
    };
}
