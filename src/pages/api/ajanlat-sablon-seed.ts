import type { APIRoute } from 'astro';
import { readEnv, saveSablon, type SablonTipus } from '../../utils/ajanlat/store';
import { urionSablonGyorsitotar } from '../../utils/ajanlat/pdf/fill';
import { SABLON_B64 } from '../../utils/ajanlat/pdf/template-b64';

export const prerender = false;

const ZIP_FEJLEC = [0x50, 0x4b, 0x03, 0x04];

function engedelyezett(request: Request): boolean {
    if (import.meta.env.DEV) return true;
    const token = readEnv('SABLON_SEED_TOKEN');
    return Boolean(token) && request.headers.get('authorization') === `Bearer ${token}`;
}

function docxNak_tunik(bytes: Uint8Array): boolean {
    return bytes.length > 4 && ZIP_FEJLEC.every((b, i) => bytes[i] === b);
}

export const POST: APIRoute = async ({ request, url }) => {
    if (!engedelyezett(request)) {
        return new Response('Not found', { status: 404 });
    }

    const tipusParam = url.searchParams.get('tipus');
    if (tipusParam !== 'nyers' && tipusParam !== 'normalizalt') {
        return new Response('A tipus paraméter kötelező: nyers | normalizalt.', { status: 400 });
    }
    const tipus: SablonTipus = tipusParam;

    const torzs = new Uint8Array(await request.arrayBuffer());

    // Üres törzsű `normalizalt` kérésnél a beágyazott base64-ből seedelünk.
    let bytes: Uint8Array;
    let forras: string;
    if (torzs.length === 0) {
        if (tipus !== 'normalizalt') {
            return new Response('A „nyers" sablonhoz fel kell tölteni a fájlt a kérés törzsében.', { status: 400 });
        }
        bytes = new Uint8Array(Buffer.from(SABLON_B64, 'base64'));
        forras = 'beágyazott base64';
    } else {
        bytes = torzs;
        forras = 'feltöltött törzs';
    }

    if (!docxNak_tunik(bytes)) {
        return new Response('A tartalom nem tűnik érvényes DOCX-nek (hiányzó ZIP-fejléc).', { status: 422 });
    }

    try {
        await saveSablon(tipus, bytes);
    } catch (hiba) {
        const uzenet = hiba instanceof Error ? hiba.message : String(hiba);
        return new Response(`A tárolás sikertelen: ${uzenet}`, { status: 500 });
    }

    // A futó instance memória-cache-ét ürítjük, hogy azonnal az új sablont használja.
    if (tipus === 'normalizalt') urionSablonGyorsitotar();

    return new Response(JSON.stringify({ ok: true, tipus, forras, meret: bytes.length }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};
