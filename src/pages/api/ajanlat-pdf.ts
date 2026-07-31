import type { APIRoute } from 'astro';
import { auditHozzaad, getPdf, getRequest, patchRequest } from '../../utils/ajanlat/store';
import { ertesitsMegtekintes } from '../../utils/ajanlat/telegram-router';
import { PDF_FAJLNEV } from '../../utils/ajanlat/pdf/generate';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: APIRoute = async ({ url }) => {
    const id = url.searchParams.get('id') ?? '';
    if (!UUID.test(id)) {
        return new Response('Érvénytelen azonosító.', { status: 400 });
    }

    const pdf = await getPdf(id);
    if (!pdf) {
        return new Response('A dokumentum nem található.', { status: 404 });
    }

    try {
        const rekord = await getRequest(id);
        if (rekord && rekord.status === 'sent') {
            await patchRequest(id, { status: 'megtekintve' });
            await auditHozzaad(id, 'ügyfél', 'megtekintve (PDF megnyitva)');
            await ertesitsMegtekintes(rekord);
        }
    } catch (hiba) {
        console.error('[ajanlat-pdf] megtekintés-jelölés sikertelen', { uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
    }

    return new Response(pdf, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${PDF_FAJLNEV}"`,
            'Cache-Control': 'private, no-store'
        }
    });
};
