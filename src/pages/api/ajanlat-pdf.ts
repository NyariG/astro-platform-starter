import type { APIRoute } from 'astro';
import { getPdf } from '../../utils/ajanlat/store';
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

    return new Response(pdf, {
        status: 200,
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${PDF_FAJLNEV}"`,
            'Cache-Control': 'private, no-store'
        }
    });
};
