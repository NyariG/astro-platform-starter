import type { APIRoute } from 'astro';
import { kuponKeres, kuponNormalizal } from '../../utils/ajanlat/coupons';
import { consumeIpQuota, dateKey, hashIp } from '../../utils/ajanlat/store';

export const prerender = false;

const KUPON_ELLENORZES_NAPI_LIMIT = 20;

function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return json({ ervenyes: false }, 200);
    }

    const nyersKod = (payload as Record<string, unknown>)?.kod;
    if (typeof nyersKod !== 'string' || nyersKod.trim() === '') {
        return json({ ervenyes: false }, 200);
    }

    if (clientAddress) {
        try {
            const engedelyezett = await consumeIpQuota(`kupon-${await hashIp(clientAddress)}`, dateKey(), KUPON_ELLENORZES_NAPI_LIMIT);
            if (!engedelyezett) return json({ error: 'rate_limit' }, 429);
        } catch (hiba) {
            console.error('[kupon] rate limit ellenőrzése sikertelen, a kérés átengedve', hiba);
        }
    }

    const { kupon, allapot } = kuponKeres(nyersKod, dateKey());
    if (allapot !== 'ervenyes' || !kupon) {
        return json({ ervenyes: false }, 200);
    }

    return json(
        {
            ervenyes: true,
            kod: kuponNormalizal(`${kupon.elotag}${kupon.szazalek}`),
            szazalek: kupon.szazalek,
            hatokorSzolgaltatasok: kupon.hatokorSzolgaltatasok ?? []
        },
        200
    );
};
