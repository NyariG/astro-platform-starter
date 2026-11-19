import { z } from 'zod';
import { EPULET_TIPUS_KODOK } from './arazas';

export const tanusitvanyKeresSema = z.object({
    tipus: z.enum(EPULET_TIPUS_KODOK, { errorMap: () => ({ message: 'Válassza ki az épület típusát.' }) }),
    nagy: z.boolean().default(false),
    telepules: z.string().trim().min(2, 'Adja meg a település nevét.').max(80, 'Túl hosszú településnév.'),
    nev: z.string().trim().min(2, 'Adja meg a nevét.').max(100, 'Túl hosszú név.'),
    telefon: z
        .string()
        .trim()
        .regex(/^\+?[0-9 ()/-]{8,20}$/, 'Adjon meg érvényes telefonszámot.'),
    email: z.string().trim().email('Adjon meg érvényes e-mail-címet.').max(200),
    mikor: z.string().trim().max(500, 'Legfeljebb 500 karakter.').default(''),
    adatkezeles: z.literal(true, { errorMap: () => ({ message: 'Az adatkezelési tájékoztató elfogadása szükséges.' }) }),
    weboldal: z.string().max(0).optional().default('')
});

export type TanusitvanyKeres = z.infer<typeof tanusitvanyKeresSema>;

export function hibakMezonkent(hiba: z.ZodError): Record<string, string> {
    const eredmeny: Record<string, string> = {};
    for (const problema of hiba.issues) {
        const kulcs = String(problema.path[0] ?? '_');
        if (!eredmeny[kulcs]) eredmeny[kulcs] = problema.message;
    }
    return eredmeny;
}
