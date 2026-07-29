import type { APIRoute } from 'astro';
import { calculateQuote } from '../../utils/ajanlat/pricing';
import { teruletSzam } from '../../utils/ajanlat/schema';
import { JOGI_NYILATKOZAT_VERZIO } from '../../utils/ajanlat/legal-notice';
import { readEnv, type QuoteRecord } from '../../utils/ajanlat/store';
import { toltsdKiSablon } from '../../utils/ajanlat/pdf/fill';
import { konvertaljDocxPdf } from '../../utils/ajanlat/pdf/generate';

export const prerender = false;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function engedelyezett(request: Request, url: URL): boolean {
    if (import.meta.env.DEV) return true;
    const vart = readEnv('DEBUG_TOKEN');
    if (!vart) return false;
    const kapott = request.headers.get('x-debug-token') ?? url.searchParams.get('debug') ?? '';
    return kapott.length > 0 && kapott === vart;
}

function bajttorzs(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function str(ertek: unknown): string {
    return typeof ertek === 'string' ? ertek : '';
}

function strTomb(ertek: unknown): string[] {
    return Array.isArray(ertek) ? ertek.filter((e): e is string => typeof e === 'string') : [];
}

function elonezetiRekord(ertekek: Record<string, unknown>): QuoteRecord {
    const alapterulet = teruletSzam(str(ertekek.alapterulet));
    const telekMeret = teruletSzam(str(ertekek.telekMeret));
    const ontozendoTerulet = teruletSzam(str(ertekek.ontozendoTerulet));
    const szolgaltatasok = strTomb(ertekek.szolgaltatasok);
    const hotermelok = strTomb(ertekek.hotermelok);
    const mennyezetHutes = str(ertekek.mennyezetHutes) || null;
    const pinceNyers = str(ertekek.pince);

    const arazas = calculateQuote({
        szolgaltatasok,
        epuletTerulet: alapterulet,
        telekMeret,
        ontozendoTerulet,
        hotermelok,
        nincsHutes: mennyezetHutes === 'nem'
    });

    return {
        id: 'debug-elonezet',
        nev: str(ertekek.nev) || 'Minta Ügyfél',
        email: str(ertekek.email) || 'minta@example.com',
        emailNormalized: '',
        telefon: str(ertekek.telefon) || null,
        varos: str(ertekek.varos) || 'Győr',
        ingatlanJelleg: str(ertekek.ingatlanJelleg) || 'lakoepulet',
        tervCelja: str(ertekek.tervCelja) || 'uj_epites',
        szintek: teruletSzam(str(ertekek.szintek)),
        pince: pinceNyers === 'van' ? true : pinceNyers === 'nincs' ? false : null,
        alapterulet,
        telekMeret,
        ontozendoTerulet,
        szolgaltatasok,
        hotermelok,
        mennyezetHutes,
        hutesOpciok: strTomb(ertekek.hutesOpciok),
        kuponKod: null,
        jogiNyilatkozatVerzio: JOGI_NYILATKOZAT_VERZIO,
        tetelek: arazas.tetelek,
        kedvezmeny: arazas.kedvezmeny,
        reszosszeg: arazas.reszosszeg,
        vegosszeg: arazas.vegosszeg,
        vanEgyediArazas: arazas.vanEgyediArazas,
        arlistaVerzio: arazas.arlistaVerzio,
        gdprConsent: true,
        status: 'new',
        attemptNumber: 1,
        ip: 'debug',
        userAgent: 'debug',
        sourceUrl: 'debug',
        createdAt: new Date().toISOString(),
        emailSentAt: null,
        emailError: null
    };
}

export const POST: APIRoute = async ({ request, url }) => {
    if (!engedelyezett(request, url)) {
        return new Response('Not found', { status: 404 });
    }

    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return new Response('A kérés formátuma hibás.', { status: 400 });
    }

    const record = elonezetiRekord((payload ?? {}) as Record<string, unknown>);

    let docx: Uint8Array;
    try {
        docx = await toltsdKiSablon(record);
    } catch (hiba) {
        const uzenet = hiba instanceof Error ? hiba.message : String(hiba);
        return new Response(`A sablon kitöltése sikertelen: ${uzenet}`, { status: 500 });
    }

    if (url.searchParams.get('format') === 'pdf') {
        const pdf = await konvertaljDocxPdf(docx, { id: 'debug', record });
        if (!pdf) {
            return new Response(
                'A PDF-konverzió nem sikerült. Ellenőrizd, hogy fut-e a konverziós szolgáltatás (PDF_CONVERTER_URL), vagy be van-e állítva a CLOUDCONVERT_API_KEY. A DOCX letöltése így is működik.',
                { status: 503 }
            );
        }
        return new Response(bajttorzs(pdf), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="arajanlat-debug.pdf"',
                'Cache-Control': 'no-store'
            }
        });
    }

    return new Response(bajttorzs(docx), {
        status: 200,
        headers: {
            'Content-Type': DOCX_MIME,
            'Content-Disposition': 'attachment; filename="arajanlat-debug.docx"',
            'Cache-Control': 'no-store'
        }
    });
};
