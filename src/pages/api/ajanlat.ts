import type { APIRoute } from 'astro';
import { fieldErrors, quoteInputSchema, teruletSzam } from '../../utils/ajanlat/schema';
import { calculateQuote, softLockAktiv } from '../../utils/ajanlat/pricing';
import { betoltArak, betoltKapcsolok, SEED_KAPCSOLOK, type ArazasKonfig, type KapcsoloKonfig } from '../../utils/ajanlat/admin-config';
import { kuponKeres, kuponNormalizal, kuponTeljesKod } from '../../utils/ajanlat/coupons';
import { betoltKuponokBiztonsagos } from '../../utils/ajanlat/kupon-store';
import { GDPR_KONSZENT_SZOVEG, GDPR_KONSZENT_VERZIO, JOGI_NYILATKOZAT_VERZIO } from '../../utils/ajanlat/legal-notice';
import { ismeteltKiserletLevele, maszkoltEmail, sikeresBekuldesLevelei } from '../../utils/ajanlat/email';
import { ertesitsUjAjanlat } from '../../utils/ajanlat/telegram-router';
import { kuldCapiLead } from '../../utils/ajanlat/meta-capi';
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

    let kapcsolok: KapcsoloKonfig = SEED_KAPCSOLOK;
    try {
        kapcsolok = await betoltKapcsolok();
    } catch (hiba) {
        console.error('[ajanlat] kapcsoló-konfiguráció betöltése sikertelen, alapértékkel folytatom', { uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
    }

    if (kapcsolok.napiLimit && clientAddress) {
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

    const softLock = softLockAktiv(input.egyediLeiras);

    const arInput = {
        szolgaltatasok: softLock ? [] : input.szolgaltatasok,
        epuletTerulet: alapterulet,
        telekMeret,
        ontozendoTerulet,
        hotermelok: softLock ? [] : input.hotermelok,

        nincsHutes: input.mennyezetHutes === 'nem',
        ingatlanJelleg: input.ingatlanJelleg,
        egyediLeiras: input.egyediLeiras
    };

    let arak: ArazasKonfig | undefined;
    try {
        arak = await betoltArak();
    } catch (hiba) {
        console.error('[ajanlat] ár-konfiguráció betöltése sikertelen, alapértékkel folytatom', { uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
    }

    const arazas = calculateQuote(arInput, undefined, undefined, arak);

    const id = crypto.randomUUID();
    const rogzitesIdo = new Date().toISOString();
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
        egyediLeiras: input.egyediLeiras.trim() === '' ? null : input.egyediLeiras.trim(),
        softLock,
        kuponKod: null,
        jogiNyilatkozatVerzio: JOGI_NYILATKOZAT_VERZIO,
        tetelek: arazas.tetelek,
        kedvezmeny: arazas.kedvezmeny,
        reszosszeg: arazas.reszosszeg,
        vegosszeg: arazas.vegosszeg,
        vanEgyediArazas: arazas.vanEgyediArazas,
        arlistaVerzio: arazas.arlistaVerzio,
        gdprConsent: input.gdprConsent,
        gdprConsentSzoveg: GDPR_KONSZENT_SZOVEG,
        gdprConsentVerzio: GDPR_KONSZENT_VERZIO,
        gdprConsentAt: rogzitesIdo,
        ip,
        userAgent: request.headers.get('user-agent') ?? '',
        sourceUrl: request.headers.get('referer') ?? url.href,
        createdAt: rogzitesIdo,
        emailSentAt: null,
        emailError: null
    } satisfies Omit<QuoteRecord, 'status' | 'attemptNumber'>;

    try {

        if (kapcsolok.napiLimit) {
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

                    try {
                        await ertesitsUjAjanlat(blokkolt);
                    } catch (hiba) {
                        console.error('[ajanlat] Telegram admin-értesítés sikertelen', { id, uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
                    }

                    console.info('[ajanlat] napi limit — ügyfél levél némán kihagyva', {
                        id,
                        email: maszkoltEmail(input.email),
                        kiserlet: attempts,
                        pontos: exact
                    });

                    return json(
                        {
                            ok: true,
                            id,
                            branch: blokkolt.ingatlanJelleg === 'lakoepulet' ? 'lakoepulet' : 'ipari_egyeb',
                            emailSent: false,
                            pdfElerheto: false,
                            vegosszeg: blokkolt.vegosszeg,
                            vanEgyediArazas: blokkolt.vanEgyediArazas,
                            kuponBevaltva: false,
                            kuponKert: input.kuponKod.trim() !== ''
                        },
                        200
                    );
                }
            }
        }

        let arazasVegleges = arazas;
        let bevaltottKupon: string | null = null;
        if (!softLock && input.kuponKod.trim() !== '') {
            const { kupon, allapot } = kuponKeres(input.kuponKod, datum, await betoltKuponokBiztonsagos());
            if (allapot === 'ervenyes' && kupon) {
                const kod = kuponNormalizal(kuponTeljesKod(kupon));
                const engedelyezett = await consumeCoupon(kod, emailNormalized, kupon.osszesBevaltasMax ?? null, kupon.emailenkentiMax ?? null);
                if (engedelyezett) {
                    bevaltottKupon = kod;
                    arazasVegleges = calculateQuote(arInput, undefined, {
                        kod,
                        szazalek: kupon.szazalek,
                        hatokorSzolgaltatasok: kupon.hatokorSzolgaltatasok
                    }, arak);
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

        const pdf = kapcsolok.pdfAdmin || kapcsolok.pdfUgyfel ? await keszitsArajanlatPdf(rekord) : null;
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
            await sikeresBekuldesLevelei(rekord, pdf, { pdfAdmin: kapcsolok.pdfAdmin, pdfUgyfel: kapcsolok.pdfUgyfel });
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

        try {
            await ertesitsUjAjanlat(rekord);
        } catch (hiba) {
            console.error('[ajanlat] Telegram admin-értesítés sikertelen', { id, uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
        }

        try {
            const cookie = request.headers.get('cookie') ?? '';
            if (/(?:^|;\s*)nyariterv-consent=granted(?:;|$)/.test(cookie)) {
                await kuldCapiLead(rekord, {
                    cookie,
                    ip: ip === 'ismeretlen' ? '' : ip,
                    userAgent: request.headers.get('user-agent') ?? '',
                    sourceUrl: rekord.sourceUrl
                });
            }
        } catch (hiba) {
            console.error('[ajanlat] Meta CAPI Lead sikertelen', { id, uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
        }

        return json(
            {
                ok: true,
                id,
                branch: rekord.ingatlanJelleg === 'lakoepulet' ? 'lakoepulet' : 'ipari_egyeb',
                emailSent: emailKiment,

                pdfElerheto: pdfElerheto && emailKiment && kapcsolok.pdfUgyfel && !rekord.vanEgyediArazas && rekord.ingatlanJelleg === 'lakoepulet',

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
