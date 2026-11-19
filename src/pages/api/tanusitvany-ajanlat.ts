import type { APIRoute } from 'astro';
import { dateKey, hashIp } from '../../utils/ajanlat/store';
import { arajanlat } from '../../utils/tanusitvany/arazas';
import { hibakMezonkent, tanusitvanyKeresSema } from '../../utils/tanusitvany/schema';
import { adminLevel, telegramUzenet, ugyfelLevel } from '../../utils/tanusitvany/uzenetek';
import { emailKuldes, ertesitesiCimek, ipKeretFoglalas, telegramErtesites } from '../../utils/tanusitvany/kuldes';

export const prerender = false;

function valasz(statusz: number, adat: Record<string, unknown>): Response {
    return new Response(JSON.stringify(adat), { status: statusz, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function hibaSzoveg(hiba: unknown): string {
    return hiba instanceof Error ? hiba.message : String(hiba);
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
    let nyers: unknown;
    try {
        nyers = await request.json();
    } catch {
        return valasz(400, { ok: false, uzenet: 'Érvénytelen kérés.' });
    }

    const eredmeny = tanusitvanyKeresSema.safeParse(nyers);
    if (!eredmeny.success) {
        const hibak = hibakMezonkent(eredmeny.error);
        if (hibak.weboldal) return valasz(200, { ok: true });
        return valasz(422, { ok: false, uzenet: 'Kérjük, javítsa a megjelölt mezőket.', hibak });
    }
    const keres = eredmeny.data;

    if (clientAddress && !(await ipKeretFoglalas(await hashIp(clientAddress), dateKey()))) {
        return valasz(429, { ok: false, uzenet: 'Ma már több ajánlatkérés érkezett erről a címről. Kérjük, hívjon telefonon.' });
    }

    const ar = arajanlat(keres.tipus, keres.telepules, keres.nagy);

    const [adminEmail, telegram] = await Promise.allSettled([emailKuldes(ertesitesiCimek(), adminLevel(keres, ar), keres.email), telegramErtesites(telegramUzenet(keres, ar))]);

    const adminhozEljutott = adminEmail.status === 'fulfilled' || (telegram.status === 'fulfilled' && telegram.value > 0);
    if (adminEmail.status === 'rejected') console.error('[tanusitvany] admin e-mail sikertelen', hibaSzoveg(adminEmail.reason));
    if (telegram.status === 'rejected') console.error('[tanusitvany] telegram sikertelen', hibaSzoveg(telegram.reason));

    if (!adminhozEljutott) {
        return valasz(502, { ok: false, uzenet: 'Az ajánlatkérést most nem sikerült elküldeni. Kérjük, hívjon telefonon, vagy próbálja újra később.' });
    }

    let visszaigazolas = true;
    try {
        await emailKuldes([keres.email], ugyfelLevel(keres, ar));
    } catch (hiba) {
        visszaigazolas = false;
        console.error('[tanusitvany] ügyfél-visszaigazolás sikertelen', hibaSzoveg(hiba));
    }

    return valasz(200, { ok: true, ar, visszaigazolas });
};
