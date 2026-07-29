import type { APIRoute } from 'astro';
import { fieldErrors, quoteInputSchema, teruletSzam } from '../../utils/ajanlat/schema';
import { calculateQuote } from '../../utils/ajanlat/pricing';
import { kuponKeres, kuponNormalizal, kuponTeljesKod } from '../../utils/ajanlat/coupons';
import { JOGI_NYILATKOZAT_VERZIO } from '../../utils/ajanlat/legal-notice';
import { ismeteltKiserletLevele, maszkoltEmail, sikeresBekuldesLevelei } from '../../utils/ajanlat/email';
import { keszitsArajanlatPdf } from '../../utils/ajanlat/pdf/generate';
import {
    claimQuota,
    consumeCoupon,
    consumeIpQuota,
    dateKey,
    hashIp,
    normalizeEmail,
    normalizePhone,
    patchRequest,
    readEnv,
    registerAttempt,
    releaseCoupon,
    releaseQuota,
    savePdf,
    saveRequest,
    type QuoteRecord
} from '../../utils/ajanlat/store';

export const prerender = false;

const ALAPERTELMEZETT_IP_LIMIT = 10;

const LIMIT_UZENET = 'Naponta csak 1 árajánlat kérhető. Kérjük, próbálja meg holnap újra, vagy vegye fel velünk a kapcsolatot közvetlenül.';

function json(body: unknown, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

function ipLimit(): number {
    const nyers = Number(readEnv('QUOTE_IP_LIMIT'));
    return Number.isFinite(nyers) && nyers > 0 ? nyers : ALAPERTELMEZETT_IP_LIMIT;
}

export const POST: APIRoute = async ({ request, clientAddress, url }) => {
    let payload: unknown;
    try {
        payload = await request.json();
    } catch {
        return json({ ok: false, error: 'validation', fields: { form: 'A kérés formátuma hibás.' } }, 400);
    }

    const csapda = (payload as Record<string, unknown>)?._cegnev;
    if (typeof csapda === 'string' && csapda.trim() !== '') {
        console.info('[ajanlat] honeypot kitöltve — csendes elutasítás');
        return json({ ok: true, id: null, branch: null }, 200);
    }

    const ellenorzott = quoteInputSchema.safeParse(payload);
    if (!ellenorzott.success) {
        return json({ ok: false, error: 'validation', fields: fieldErrors(ellenorzott.error) }, 400);
    }
    const input = ellenorzott.data;

    const ip = clientAddress ?? 'ismeretlen';
    const datum = dateKey();
    const emailNormalized = normalizeEmail(input.email);

    if (clientAddress) {
        try {
            const engedelyezett = await consumeIpQuota(await hashIp(clientAddress), datum, ipLimit());
            if (!engedelyezett) {
                console.warn('[ajanlat] IP-korlát túllépve', { datum });
                return json({ ok: false, error: 'ip_limit' }, 429);
            }
        } catch (hiba) {
            console.error('[ajanlat] IP-korlát ellenőrzése sikertelen, a kérés átengedve', hiba);
        }
    }

    const alapterulet = teruletSzam(input.alapterulet);
    const telekMeret = teruletSzam(input.telekMeret);
    const ontozendoTerulet = teruletSzam(input.ontozendoTerulet);

    const arInput = {
        szolgaltatasok: input.szolgaltatasok,
        epuletTerulet: alapterulet,
        telekMeret,
        ontozendoTerulet,
        hotermelok: input.hotermelok,

        nincsHutes: input.mennyezetHutes === 'nem'
    };

    const arazas = calculateQuote(arInput);

    const id = crypto.randomUUID();
    const alap = {
        id,
        nev: input.nev,
        email: input.email,
        emailNormalized,
        telefon: normalizePhone(input.telefon),
        varos: input.varos,
        ingatlanJelleg: input.ingatlanJelleg,
        tervCelja: input.tervCelja,
        szintek: teruletSzam(input.szintek),

        pince: input.pince === 'van' ? true : input.pince === 'nincs' ? false : null,
        alapterulet,
        telekMeret,
        ontozendoTerulet,
        szolgaltatasok: input.szolgaltatasok,
        hotermelok: input.hotermelok,
        mennyezetHutes: input.mennyezetHutes === '' ? null : input.mennyezetHutes,
        hutesOpciok: input.hutesOpciok,
        kuponKod: null,
        jogiNyilatkozatVerzio: JOGI_NYILATKOZAT_VERZIO,
        tetelek: arazas.tetelek,
        kedvezmeny: arazas.kedvezmeny,
        reszosszeg: arazas.reszosszeg,
        vegosszeg: arazas.vegosszeg,
        vanEgyediArazas: arazas.vanEgyediArazas,
        arlistaVerzio: arazas.arlistaVerzio,
        gdprConsent: input.gdprConsent,
        ip,
        userAgent: request.headers.get('user-agent') ?? '',
        sourceUrl: request.headers.get('referer') ?? url.href,
        createdAt: new Date().toISOString(),
        emailSentAt: null,
        emailError: null
    } satisfies Omit<QuoteRecord, 'status' | 'attemptNumber'>;

    try {

        const { claimed } = await claimQuota(emailNormalized, datum, id);

        if (!claimed) {
            const { attempts, exact, reclaimed } = await registerAttempt(emailNormalized, datum, id);

            if (!reclaimed) {
                const blokkolt: QuoteRecord = { ...alap, status: 'blocked', attemptNumber: attempts };
                await saveRequest(blokkolt);

                try {
                    await ismeteltKiserletLevele(blokkolt, exact);
                } catch (hiba) {
                    const uzenet = hiba instanceof Error ? hiba.message : String(hiba);
                    console.error('[ajanlat] üzemeltetői figyelmeztetés küldése sikertelen', { id, uzenet });
                    await patchRequest(id, { emailError: uzenet });
                }

                console.info('[ajanlat] napi limit blokkolta', {
                    id,
                    email: maszkoltEmail(input.email),
                    kiserlet: attempts,
                    pontos: exact
                });

                return json({ ok: false, error: 'daily_limit', message: LIMIT_UZENET }, 429);
            }
        }

        let arazasVegleges = arazas;
        let bevaltottKupon: string | null = null;
        if (input.kuponKod.trim() !== '') {
            const { kupon, allapot } = kuponKeres(input.kuponKod, datum);
            if (allapot === 'ervenyes' && kupon) {
                const kod = kuponNormalizal(kuponTeljesKod(kupon));
                const engedelyezett = await consumeCoupon(kod, emailNormalized, kupon.osszesBevaltasMax ?? null, kupon.emailenkentiMax ?? null);
                if (engedelyezett) {
                    bevaltottKupon = kod;
                    arazasVegleges = calculateQuote(arInput, undefined, {
                        kod,
                        szazalek: kupon.szazalek,
                        hatokorSzolgaltatasok: kupon.hatokorSzolgaltatasok
                    });
                }
            }
        }

        const rekord: QuoteRecord = {
            ...alap,
            status: 'new',
            attemptNumber: 1,
            kuponKod: bevaltottKupon,
            tetelek: arazasVegleges.tetelek,
            kedvezmeny: arazasVegleges.kedvezmeny,
            reszosszeg: arazasVegleges.reszosszeg,
            vegosszeg: arazasVegleges.vegosszeg,
            vanEgyediArazas: arazasVegleges.vanEgyediArazas
        };
        await saveRequest(rekord);

        const pdf = await keszitsArajanlatPdf(rekord);
        let pdfElerheto = false;
        if (pdf) {
            try {
                await savePdf(id, pdf);
                pdfElerheto = true;
            } catch (hiba) {
                console.error('[ajanlat] PDF tárolása sikertelen — a csatolt levél ettől még kimehet', { id });
            }
        }

        let emailKiment = true;
        try {
            await sikeresBekuldesLevelei(rekord, pdf);
            await patchRequest(id, { status: 'sent', emailSentAt: new Date().toISOString() });
            console.info('[ajanlat] rögzítve és kiküldve', {
                id,
                email: maszkoltEmail(input.email),
                jelleg: rekord.ingatlanJelleg,
                kupon: bevaltottKupon ?? '—'
            });
        } catch (hiba) {
            emailKiment = false;
            const uzenet = hiba instanceof Error ? hiba.message : String(hiba);
            console.error('[ajanlat] e-mail küldés sikertelen', { id, uzenet });
            await patchRequest(id, { status: 'failed', emailError: uzenet });

            await releaseQuota(emailNormalized, datum);
            if (bevaltottKupon) await releaseCoupon(bevaltottKupon, emailNormalized);
        }

        return json(
            {
                ok: true,
                id,
                branch: rekord.ingatlanJelleg === 'lakoepulet' ? 'lakoepulet' : 'ipari_egyeb',
                emailSent: emailKiment,

                pdfElerheto: pdfElerheto && emailKiment,

                vegosszeg: arazasVegleges.vegosszeg,
                vanEgyediArazas: arazasVegleges.vanEgyediArazas,

                kuponBevaltva: bevaltottKupon !== null,
                kuponKert: input.kuponKod.trim() !== ''
            },
            200
        );
    } catch (hiba) {
        console.error('[ajanlat] tárolási hiba', hiba);
        return json({ ok: false, error: 'server' }, 500);
    }
};
