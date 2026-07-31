import type { APIRoute } from 'astro';
import type { QuoteRecord } from '../../utils/ajanlat/store';
import { ertesitsUjAjanlat } from '../../utils/ajanlat/telegram-router';

export const prerender = false;

function mintaRekord(): QuoteRecord {
    return {
        id: 'preview0-0000-4000-8000-000000000001',
        nev: 'Minta Ügyfél (előnézet)',
        email: 'minta@example.com',
        telefon: '+36 30 111 2222',
        varos: 'Győr',
        ingatlanJelleg: 'lakoepulet',
        tetelek: [
            { kod: 'muszaki_leiras', megnevezes: 'Műszaki leírás egyszerű bejelentéshez', osszeg: 60000, status: 'PRICED' },
            { kod: 'futesi_terv', megnevezes: 'Fűtési terv', osszeg: 290000, status: 'PRICED' },
            { kod: 'hotermelo_felar', megnevezes: 'Hőtermelő felár (2 db)', osszeg: 60000, status: 'PRICED' },
            { kod: 'klimaterv', megnevezes: 'Klímaterv', osszeg: 50000, status: 'PRICED' }
        ],
        kedvezmeny: { tipus: 'mennyezet_hutes', cimke: 'Kedvezmény (nem kér mennyezet hűtést): −5%', alap: 350000, szazalek: 5, osszeg: 17500, kuponKod: null },
        reszosszeg: 460000,
        vegosszeg: 442500,
        vanEgyediArazas: false,
        createdAt: new Date().toISOString()
    } as unknown as QuoteRecord;
}

export const GET: APIRoute = async ({ url }) => {
    if (!import.meta.env.DEV && !url.searchParams.has('debug')) {
        return new Response('Not found', { status: 404 });
    }

    try {
        await ertesitsUjAjanlat(mintaRekord());
    } catch (hiba) {
        return new Response(JSON.stringify({ ok: false, uzenet: hiba instanceof Error ? hiba.message : String(hiba) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        });
    }

    return new Response(JSON.stringify({ ok: true, uzenet: 'Előnézeti üzenet elküldve az összekötött adminoknak (ha van bot-token és admin).' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
};
