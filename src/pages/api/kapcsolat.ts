import type { APIRoute } from 'astro';
import { dateKey, hashIp } from '../../utils/ajanlat/store';
import { kapcsolatCimzettek, kapcsolatLevel, kapcsolatSema } from '../../utils/kapcsolat';
import { emailKuldes, ipKeretFoglalas } from '../../utils/tanusitvany/kuldes';
import { hibakMezonkent } from '../../utils/tanusitvany/schema';

export const prerender = false;

function valasz(statusz: number, adat: Record<string, unknown>): Response {
    return new Response(JSON.stringify(adat), { status: statusz, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
    let nyers: unknown;
    try {
        nyers = await request.json();
    } catch {
        return valasz(400, { ok: false, uzenet: 'Érvénytelen kérés.' });
    }

    const eredmeny = kapcsolatSema.safeParse(nyers);
    if (!eredmeny.success) {
        const hibak = hibakMezonkent(eredmeny.error);
        if (hibak.weboldal) return valasz(200, { ok: true });
        return valasz(422, { ok: false, uzenet: 'Kérjük, javítsa a megjelölt mezőket.', hibak });
    }

    if (clientAddress && !(await ipKeretFoglalas(await hashIp(clientAddress), dateKey(), 'kapcsolat'))) {
        return valasz(429, { ok: false, uzenet: 'Ma már több üzenet érkezett erről a címről. Kérjük, hívjon telefonon.' });
    }

    const oldal = request.headers.get('referer') ?? 'ismeretlen';
    try {
        await emailKuldes(kapcsolatCimzettek(), kapcsolatLevel(eredmeny.data, oldal), eredmeny.data.email);
    } catch (hiba) {
        console.error('[kapcsolat] levélküldés sikertelen', hiba instanceof Error ? hiba.message : String(hiba));
        return valasz(502, { ok: false, uzenet: 'Az üzenetet most nem sikerült elküldeni. Kérjük, hívjon telefonon, vagy írjon az info@nyariterv.hu címre.' });
    }

    return valasz(200, { ok: true });
};
