import { z } from 'zod';
import { HOTERMELOK_VALUES, HUTES_OPCIOK_VALUES, INGATLAN_JELLEG_VALUES, MENNYEZET_HUTES_VALUES, PINCE_VALUES, SZOLGALTATAS_VALUES, TERV_CELJA_VALUES } from './options';
import { FUTESI_TERV, szuksegesTeruletek, type TeruletFajta } from './pricing-config';

type EnumValues = [string, ...string[]];

const ingatlanJellegValues = INGATLAN_JELLEG_VALUES as EnumValues;
const tervCeljaValues = TERV_CELJA_VALUES as EnumValues;
const szolgaltatasValues = SZOLGALTATAS_VALUES as EnumValues;
const hotermelokValues = HOTERMELOK_VALUES as EnumValues;
const mennyezetHutesValues = MENNYEZET_HUTES_VALUES as EnumValues;
const hutesOpciokValues = HUTES_OPCIOK_VALUES as EnumValues;
const pinceValues = PINCE_VALUES as EnumValues;

const TELEFON_MIN_JEGY = 7;
const TELEFON_MAX_JEGY = 20;

export const TERULET_MIN = 1;
export const TERULET_MAX = 100_000;

const TERULET_REGEX = /^\d{1,6}$/;

export const TERULET_UZENET = {
    hianyzik: 'Kérjük, adja meg az alapterületet.',
    nemEgesz: 'Csak egész szám adható meg.',
    tulKicsi: `Az érték legalább ${TERULET_MIN} lehet.`,
    tulNagy: 'Az érték legfeljebb 100 000 lehet.'
} as const;

/**
 * Egy nyers területszöveg ellenőrzése és számmá alakítása.
 * Érvénytelen bemenetre a hibaüzenetet adja vissza, nem dob.
 */
export type TeruletEredmeny = { ok: true; ertek: number } | { ok: false; uzenet: string };

export function teruletErtelmezes(nyers: string): TeruletEredmeny {
    const trimmelt = (nyers ?? '').trim();
    if (trimmelt === '') return { ok: false, uzenet: TERULET_UZENET.hianyzik };
    if (!TERULET_REGEX.test(trimmelt)) return { ok: false, uzenet: TERULET_UZENET.nemEgesz };

    const szam = Number.parseInt(trimmelt, 10);
    if (!Number.isFinite(szam)) return { ok: false, uzenet: TERULET_UZENET.nemEgesz };
    if (szam < TERULET_MIN) return { ok: false, uzenet: TERULET_UZENET.tulKicsi };
    if (szam > TERULET_MAX) return { ok: false, uzenet: TERULET_UZENET.tulNagy };

    return { ok: true, ertek: szam };
}

/** Ellenőrzött területszöveg → szám. Érvénytelen bemenetre `null`. */
export function teruletSzam(nyers: string | null | undefined): number | null {
    const eredmeny = teruletErtelmezes(nyers ?? '');
    return eredmeny.ok ? eredmeny.ertek : null;
}

/** A területmezők neve fajtánként — a feltételes kötelezőséghez. */
const TERULET_MEZO: Record<TeruletFajta, 'alapterulet' | 'telekMeret' | 'ontozendoTerulet'> = {
    epulet: 'alapterulet',
    telek: 'telekMeret',
    ontozes: 'ontozendoTerulet'
};

export const quoteObjectSchema = z.object({
    nev: z
        .string({ required_error: 'Kérjük, adja meg a nevét.' })
        .trim()
        .min(2, 'Kérjük, adja meg a nevét.')
        .max(80, 'A név legfeljebb 80 karakter lehet.'),

    email: z
        .string({ required_error: 'Adjon meg egy érvényes e-mail címet.' })
        .trim()
        .max(160, 'Az e-mail cím legfeljebb 160 karakter lehet.')
        .email('Adjon meg egy érvényes e-mail címet.'),

    telefon: z.string().trim().max(30, 'A telefonszám legfeljebb 30 karakter lehet.').optional().default(''),

    varos: z
        .string({ required_error: 'Kérjük, adja meg a települést.' })
        .trim()
        .min(2, 'Kérjük, adja meg a települést.')
        .max(60, 'A település neve legfeljebb 60 karakter lehet.'),

    ingatlanJelleg: z.enum(ingatlanJellegValues, {
        errorMap: () => ({ message: 'Válassza ki az ingatlan jellegét.' })
    }),

    tervCelja: z.enum(tervCeljaValues, {
        errorMap: () => ({ message: 'Válassza ki a terv célját.' })
    }),

    /** Tájékoztató adat, az árazásban nem szerepel. */
    szintek: z.string({ invalid_type_error: TERULET_UZENET.nemEgesz }).trim().optional().default(''),

    /** Pince megléte — opcionális, tájékoztató adat; az árazást nem befolyásolja. */
    pince: z.enum(pinceValues, { errorMap: () => ({ message: 'Érvénytelen érték.' }) }).or(z.literal('')).default(''),

    // Területmezők — a kötelezőségük a választott szolgáltatásoktól függ.
    // Az `invalid_type_error` azért kell, hogy a közvetlen API-hívással
    // érkező null / tömb / objektum se angol zod-üzenetet váltson ki.
    alapterulet: z.string({ invalid_type_error: TERULET_UZENET.nemEgesz }).trim().optional().default(''),
    telekMeret: z.string({ invalid_type_error: TERULET_UZENET.nemEgesz }).trim().optional().default(''),
    ontozendoTerulet: z.string({ invalid_type_error: TERULET_UZENET.nemEgesz }).trim().optional().default(''),

    szolgaltatasok: z
        .array(z.enum(szolgaltatasValues, { errorMap: () => ({ message: 'Ismeretlen szolgáltatás.' }) }), {
            invalid_type_error: 'Válasszon legalább egy szolgáltatást.'
        })
        .min(1, 'Válasszon legalább egy szolgáltatást.'),

    hotermelok: z.array(z.enum(hotermelokValues, { errorMap: () => ({ message: 'Ismeretlen hőtermelő.' }) })).default([]),

    /**
     * „Szeretne mennyezet hűtést?” — a „nem" válasz jár 5% kedvezménnyel.
     * Szándékosan nem logikai érték: üresen hagyva nem adunk kedvezményt,
     * és nem is feltételezünk semmit az ügyfél helyett.
     */
    mennyezetHutes: z.enum(mennyezetHutesValues, { errorMap: () => ({ message: 'Válaszoljon a mennyezet hűtésre vonatkozó kérdésre.' }) }).or(z.literal('')).default(''),

    /**
     * A Hűtési terv informatív alopciói (Hőszivattyú / Fan-coil / Mennyezethűtés).
     * NEM árazott — az igény jelzésére, a rekordba és az e-mailekbe kerül.
     * Kliensoldalon a láthatóság kapuzza; a szerver csak az értékkészletet nézi.
     */
    hutesOpciok: z.array(z.enum(hutesOpciokValues, { errorMap: () => ({ message: 'Ismeretlen hűtési opció.' }) })).default([]),

    /** Opcionális kuponkód. A szerver validálja és váltja be — üres = nincs kupon. */
    kuponKod: z.string().trim().max(20, 'A kuponkód túl hosszú.').optional().default(''),

    gdprConsent: z.literal(true, {
        errorMap: () => ({ message: 'Az adatkezelési hozzájárulás megadása kötelező.' })
    })
});

export const quoteInputSchema = quoteObjectSchema.superRefine((data, ctx) => {
    // Területmezők: csak akkor kötelezőek, ha van rájuk támaszkodó szolgáltatás.
    for (const fajta of szuksegesTeruletek(data.szolgaltatasok)) {
        const mezo = TERULET_MEZO[fajta];
        const eredmeny: TeruletEredmeny = teruletErtelmezes(String(data[mezo] ?? ''));
        if (eredmeny.ok === false) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: [mezo], message: eredmeny.uzenet });
        }
    }

    // A szintek száma opcionális, de ha megadták, legyen értelmes egész.
    if (data.szintek !== '') {
        const eredmeny = teruletErtelmezes(data.szintek);
        if (!eredmeny.ok || eredmeny.ertek > 50) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['szintek'],
                message: 'A szintek száma 1 és 50 között lehet.'
            });
        }
    }

    // A „Szeretne mennyezet hűtést?" kérdés kötelezőségét a kliens kapuzza
    // (csak a Hűtési terv csoport nyitott állapotában — lásd lathatosag.ts).
    // Szerveroldalon ezért opcionális: üres = nincs kedvezmény. Így a csak
    // fűtést kérő beküldés nem bukik el egy rejtett mező miatt.

    // Fűtési terv esetén a hőtermelő megadása kötelező.
    if (data.szolgaltatasok.includes(FUTESI_TERV) && data.hotermelok.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['hotermelok'],
            message: 'Fűtési terv esetén válasszon legalább egy hőtermelőt.'
        });
    }

    // Hőtermelő fűtési terv nélkül értelmezhetetlen — a kliens ilyet nem küld,
    // de a végpont közvetlen hívásánál előfordulhat.
    if (!data.szolgaltatasok.includes(FUTESI_TERV) && data.hotermelok.length > 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['hotermelok'],
            message: 'Hőtermelő csak fűtési terv igénylése esetén választható.'
        });
    }

    // A telefonszám opcionális, de ha kitöltötték, legyen értelmezhető.
    if (data.telefon) {
        const jegyek = data.telefon.replace(/\D/g, '').length;
        if (jegyek < TELEFON_MIN_JEGY || jegyek > TELEFON_MAX_JEGY) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['telefon'],
                message: 'A telefonszám formátuma nem megfelelő.'
            });
        }
    }
});

export type QuoteFormInput = z.infer<typeof quoteInputSchema>;

/** Egy mezőnév → egy hibaüzenet. Ha egy mezőn több hiba van, az elsőt adja vissza. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
    const result: Record<string, string> = {};
    for (const issue of error.issues) {
        const key = issue.path.length > 0 ? String(issue.path[0]) : 'form';
        if (!(key in result)) result[key] = issue.message;
    }
    return result;
}
