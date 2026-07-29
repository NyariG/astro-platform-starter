import { HOTERMELOK, HUTES_OPCIOK, INGATLAN_JELLEG, MENNYEZET_HUTES, SZOLGALTATAS_OPCIOK, TERV_CELJA, labelOf, labelsOf } from './options';
import { forint, negyzetmeter } from './format';
import { JOGI_ROVID } from './legal-notice';
import type { QuoteRecord } from './store';

function jogiLevelHtml(record: QuoteRecord): string {
    return `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid ${KERET};color:${HALVANY};font-size:12px;line-height:1.5;">${esc(JOGI_ROVID)}${
        record.jogiNyilatkozatVerzio ? ` (Tájékoztató v${esc(record.jogiNyilatkozatVerzio)})` : ''
    }</p>`;
}

function jogiLevelText(record: QuoteRecord): string {
    return `\n${JOGI_ROVID}${record.jogiNyilatkozatVerzio ? ` (Tájékoztató v${record.jogiNyilatkozatVerzio})` : ''}`;
}

const MARKA = '#2563eb';
const SZOVEG = '#0f172a';
const HALVANY = '#64748b';
const KERET = '#e2e8f0';
const HATTER = '#f8fafc';

export type EmailTorzs = {
    subject: string;
    html: string;
    text: string;
};

function esc(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function datumHu(iso: string): string {
    return new Intl.DateTimeFormat('hu-HU', {
        timeZone: 'Europe/Budapest',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(iso));
}

function adatSorok(record: QuoteRecord): [string, string][] {
    const sorok: [string, string][] = [
        ['Név', record.nev],
        ['E-mail', record.email],
        ['Telefon', record.telefon ?? '—'],
        ['Település', record.varos],
        ['Ingatlan jellege', labelOf(INGATLAN_JELLEG, record.ingatlanJelleg)],
        ['Terv célja', labelOf(TERV_CELJA, record.tervCelja)]
    ];

    if (record.alapterulet !== null) sorok.push(['Épület alapterülete', negyzetmeter(record.alapterulet)]);
    if (record.szintek !== null) sorok.push(['Szintek száma', String(record.szintek)]);
    if (record.pince !== null) sorok.push(['Pince', record.pince ? 'Van' : 'Nincs']);
    if (record.telekMeret !== null) sorok.push(['Telekméret', negyzetmeter(record.telekMeret)]);
    if (record.ontozendoTerulet !== null) sorok.push(['Öntözendő terület', negyzetmeter(record.ontozendoTerulet)]);

    sorok.push(['Kért szolgáltatások', labelsOf(SZOLGALTATAS_OPCIOK, record.szolgaltatasok).join(', ')]);

    if (record.hotermelok.length > 0) {
        sorok.push(['Hőtermelők', labelsOf(HOTERMELOK, record.hotermelok).join(', ')]);
    }
    if (record.mennyezetHutes) {
        sorok.push(['Mennyezet hűtés', labelOf(MENNYEZET_HUTES, record.mennyezetHutes)]);
    }

    if ((record.hutesOpciok ?? []).length > 0) {
        sorok.push(['Hűtési igények', labelsOf(HUTES_OPCIOK, record.hutesOpciok ?? []).join(', ')]);
    }

    sorok.push(['Beérkezett', datumHu(record.createdAt)]);
    return sorok;
}

function arTablaHtml(record: QuoteRecord): string {
    const sorok = record.tetelek
        .map((tetel) => {
            const reszlet = tetel.terulet !== null ? ` <span style="color:${HALVANY};font-weight:400;">(${negyzetmeter(tetel.terulet)})</span>` : '';
            const ertek = tetel.status === 'CUSTOM_QUOTE' ? `<span style="color:${MARKA};">Egyedi árazás</span>` : forint(tetel.osszeg ?? 0);
            return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${KERET};color:${SZOVEG};font-size:14px;">${esc(tetel.megnevezes)}${reszlet}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${KERET};color:${SZOVEG};font-size:14px;font-weight:600;text-align:right;white-space:nowrap;">${ertek}</td>
        </tr>`;
        })
        .join('');

    const kedvezmenySor = record.kedvezmeny
        ? `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${KERET};color:#15803d;font-size:14px;">${esc(record.kedvezmeny.cimke)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${KERET};color:#15803d;font-size:14px;font-weight:600;text-align:right;white-space:nowrap;">−${forint(record.kedvezmeny.osszeg)}</td>
        </tr>`
        : '';

    const vegosszegSor =
        record.vegosszeg !== null
            ? `
        <tr>
          <td style="padding:12px;color:${SZOVEG};font-size:16px;font-weight:bold;">Végösszeg</td>
          <td style="padding:12px;color:${SZOVEG};font-size:18px;font-weight:bold;text-align:right;white-space:nowrap;">${forint(record.vegosszeg)}</td>
        </tr>`
            : `
        <tr>
          <td colspan="2" style="padding:12px;color:${MARKA};font-size:15px;font-weight:bold;">Egyedi ajánlat — a végösszeg egyeztetést igényel</td>
        </tr>`;

    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid ${KERET};border-radius:6px;overflow:hidden;">${sorok}${kedvezmenySor}${vegosszegSor}</table>`;
}

/** Az egyedi árazású tételek szó szerinti tájékoztató üzenetei. */
function egyediUzenetek(record: QuoteRecord): string[] {
    return record.tetelek.map((t) => t.uzenet).filter((uzenet): uzenet is string => Boolean(uzenet));
}

function egyediUzenetekHtml(record: QuoteRecord): string {
    const uzenetek = egyediUzenetek(record);
    if (uzenetek.length === 0) return '';
    const elemek = uzenetek.map((uzenet) => `<p style="margin:0 0 8px;">${esc(uzenet)}</p>`).join('');
    return `<div style="margin:16px 0 0;padding:14px 16px;background:#eff6ff;border-left:4px solid ${MARKA};color:${SZOVEG};font-size:14px;line-height:1.5;">${elemek}</div>`;
}

function egyediUzenetekText(record: QuoteRecord): string {
    const uzenetek = egyediUzenetek(record);
    return uzenetek.length === 0 ? '' : `\n${uzenetek.join('\n')}\n`;
}

function arTablaText(record: QuoteRecord): string {
    const sorok = record.tetelek.map((tetel) => {
        const reszlet = tetel.terulet !== null ? ` (${negyzetmeter(tetel.terulet)})` : '';
        const ertek = tetel.status === 'CUSTOM_QUOTE' ? 'Egyedi árazás' : forint(tetel.osszeg ?? 0);
        return `${tetel.megnevezes}${reszlet}: ${ertek}`;
    });

    if (record.kedvezmeny) {
        sorok.push(`${record.kedvezmeny.cimke} = -${forint(record.kedvezmeny.osszeg)}`);
    }
    sorok.push(record.vegosszeg !== null ? `VÉGÖSSZEG: ${forint(record.vegosszeg)}` : 'EGYEDI AJÁNLAT — a végösszeg egyeztetést igényel');

    return sorok.join('\n');
}

function adatTablaHtml(record: QuoteRecord): string {
    const sorok = adatSorok(record)
        .map(
            ([cimke, ertek]) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid ${KERET};color:${HALVANY};font-size:13px;white-space:nowrap;vertical-align:top;">${esc(cimke)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid ${KERET};color:${SZOVEG};font-size:14px;font-weight:600;">${esc(ertek)}</td>
        </tr>`
        )
        .join('');

    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;border:1px solid ${KERET};border-radius:6px;overflow:hidden;">${sorok}</table>`;
}

function adatTablaText(record: QuoteRecord): string {
    return adatSorok(record)
        .map(([cimke, ertek]) => `${cimke}: ${ertek}`)
        .join('\n');
}

/** Közös levélkeret: fejléc, törzs, lábléc. */
function keret(cim: string, torzsHtml: string): string {
    return `<!doctype html>
<html lang="hu">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(cim)}</title></head>
<body style="margin:0;padding:0;background:${HATTER};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${HATTER};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;background:#ffffff;border:1px solid ${KERET};border-radius:8px;font-family:Arial,Helvetica,sans-serif;">
          <tr>
            <td style="padding:20px 24px;border-bottom:3px solid ${MARKA};">
              <span style="font-size:20px;font-weight:bold;color:${SZOVEG};"><span style="color:${MARKA};">Nyári</span>Terv</span>
            </td>
          </tr>
          <tr><td style="padding:24px;color:${SZOVEG};font-size:15px;line-height:1.6;">${torzsHtml}</td></tr>
          <tr>
            <td style="padding:16px 24px;border-top:1px solid ${KERET};color:${HALVANY};font-size:12px;line-height:1.5;">
              Nyári Terv — épületgépészeti tervezés, Győr és környéke<br>
              <a href="mailto:info@nyariterv.hu" style="color:${MARKA};text-decoration:none;">info@nyariterv.hu</a> &nbsp;·&nbsp;
              <a href="tel:+36703187843" style="color:${MARKA};text-decoration:none;">+36 70 318 7843</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * ══════════════════════════════════════════════════════════════════════════
 *  BEILLESZTÉSI PONT — lakóépület, ügyfélnek szánt levél törzse
 *
 *  A végleges árajánlat-sablon megérkezésekor EZ a függvény cserélendő.
 *  Bemenet: a teljes rekord. Kimenet: a levél HTML törzse (a közös kereten
 *  belüli rész) és a szöveges alternatíva.
 *
 *  A jelenlegi tartalom nem placeholder: teljes értékű, működő visszaigazoló
 *  levél, ami az ügyfél által megadott adatokat is visszatükrözi.
 * ══════════════════════════════════════════════════════════════════════════
 */
function lakoepuletUgyfelTorzs(record: QuoteRecord): { html: string; text: string } {
    const html = `
    <p style="margin:0 0 16px;">Kedves ${esc(record.nev)}!</p>
    <p style="margin:0 0 16px;">
      Köszönjük megkeresését. Az árajánlatkéréshez megadott adatait rögzítettük,
      és megkezdtük a feldolgozásukat.
    </p>
    <p style="margin:0 0 20px;">
      Tervezőnk a megadott elérhetőségen hamarosan felveszi Önnel a kapcsolatot
      a részletek egyeztetése és az árajánlat véglegesítése céljából.
    </p>
    <p style="margin:0 0 12px;font-weight:bold;">Az árajánlat tételei:</p>
    ${arTablaHtml(record)}
    ${egyediUzenetekHtml(record)}
    <p style="margin:24px 0 12px;font-weight:bold;">A rögzített adatok:</p>
    ${adatTablaHtml(record)}
    ${jogiLevelHtml(record)}
    <p style="margin:20px 0 0;color:${HALVANY};font-size:13px;">
      Ha bármelyik adat pontosításra szorul, válaszoljon erre a levélre,
      vagy hívjon minket a +36 70 318 7843 számon.
    </p>`;

    const text = `Kedves ${record.nev}!

Köszönjük megkeresését. Az árajánlatkéréshez megadott adatait rögzítettük, és megkezdtük a feldolgozásukat.

Tervezőnk a megadott elérhetőségen hamarosan felveszi Önnel a kapcsolatot a részletek egyeztetése és az árajánlat véglegesítése céljából.

Az árajánlat tételei:
${arTablaText(record)}
${egyediUzenetekText(record)}
A rögzített adatok:
${adatTablaText(record)}
${jogiLevelText(record)}

Ha bármelyik adat pontosításra szorul, válaszoljon erre a levélre, vagy hívjon minket a +36 70 318 7843 számon.

Nyári Terv — épületgépészeti tervezés, Győr és környéke
info@nyariterv.hu · +36 70 318 7843`;

    return { html, text };
}

/** 1. ág — lakóépület, első aznapi kérés. */
export function lakoepuletUgyfelLevel(record: QuoteRecord): EmailTorzs {
    const { html, text } = lakoepuletUgyfelTorzs(record);
    return {
        subject: 'Árajánlatkérését rögzítettük — Nyári Terv',
        html: keret('Árajánlatkérését rögzítettük', html),
        text
    };
}

/** 2. ág — ipari vagy egyéb ingatlan, első aznapi kérés. */
/**
 * 2. ág — ipari vagy egyéb ingatlan.
 *
 * Ezekre a projektekre szándékosan NEM küldünk automatikus árajánlatot: a
 * díjszabás egyedi elbírálást igényel. Az ügyfél egy komoly, megnyugtató
 * visszaigazolást kap arról, hogy a megkeresését rögzítettük és kollégánk
 * hamarosan jelentkezik. Az árbontás csak az üzemeltetői levélben szerepel.
 */
export function altalanosUgyfelLevel(record: QuoteRecord): EmailTorzs {
    const html = `
    <p style="margin:0 0 16px;">Kedves ${esc(record.nev)}!</p>
    <p style="margin:0 0 16px;">
      Köszönjük, hogy megkereste a Nyári Tervet, és bizalmával megtisztelt bennünket.
    </p>
    <p style="margin:0 0 16px;">
      Az ipari és az egyedi jellegű projektek minden esetben személyre szabott tervezői
      megközelítést igényelnek, ezért ezekre nem automatikus kalkulációval, hanem az igények
      alapos felmérését követően, egyedi árajánlattal válaszolunk. Megkeresését és a megadott
      adatokat rendszerünkben rögzítettük.
    </p>
    <p style="margin:0 0 20px;">
      Kollégánk a megadott elérhetőségen hamarosan felveszi Önnel a kapcsolatot, hogy egyeztessük
      a részleteket, és összeállítsuk az Ön projektjére szabott ajánlatot.
    </p>
    <p style="margin:0 0 12px;font-weight:bold;">Az Ön által megadott adatok:</p>
    ${adatTablaHtml(record)}
    <p style="margin:20px 0 0;color:${HALVANY};font-size:13px;">
      Amennyiben időközben bármilyen kérdése merülne fel, keressen minket bizalommal — készséggel állunk rendelkezésére.
    </p>
    ${jogiLevelHtml(record)}`;

    const text = `Kedves ${record.nev}!

Köszönjük, hogy megkereste a Nyári Tervet, és bizalmával megtisztelt bennünket.

Az ipari és az egyedi jellegű projektek minden esetben személyre szabott tervezői megközelítést igényelnek, ezért ezekre nem automatikus kalkulációval, hanem az igények alapos felmérését követően, egyedi árajánlattal válaszolunk. Megkeresését és a megadott adatokat rendszerünkben rögzítettük.

Kollégánk a megadott elérhetőségen hamarosan felveszi Önnel a kapcsolatot, hogy egyeztessük a részleteket, és összeállítsuk az Ön projektjére szabott ajánlatot.

Az Ön által megadott adatok:
${adatTablaText(record)}
${jogiLevelText(record)}

Amennyiben időközben bármilyen kérdése merülne fel, keressen minket bizalommal — készséggel állunk rendelkezésére.

Nyári Terv — épületgépészeti tervezés, Győr és környéke
info@nyariterv.hu · +36 70 318 7843`;

    return {
        subject: 'Megkeresését rögzítettük — Nyári Terv',
        html: keret('Megkeresését rögzítettük', html),
        text
    };
}

/** Üzemeltetői adatlap — mindkét sikeres ágban ez megy ki. */
export function uzemeltetoiAdatlap(record: QuoteRecord): EmailTorzs {
    const jelleg = labelOf(INGATLAN_JELLEG, record.ingatlanJelleg);

    const html = `
    <p style="margin:0 0 16px;font-size:17px;font-weight:bold;">Új árajánlatkérés érkezett</p>
    <p style="margin:0 0 20px;color:${HALVANY};font-size:14px;">
      Ingatlan jellege: <strong style="color:${SZOVEG};">${esc(jelleg)}</strong> ·
      Azonosító: <code style="font-size:12px;">${esc(record.id)}</code>
    </p>
    ${record.vanEgyediArazas ? `<p style="margin:0 0 16px;padding:12px 14px;background:#fef3c7;border-left:4px solid #b45309;color:${SZOVEG};font-size:14px;font-weight:600;">Egyedi árazás szükséges — a végösszeg nem számolható automatikusan.</p>` : ''}
    <p style="margin:0 0 12px;font-weight:bold;">Árajánlat tételei:</p>
    ${arTablaHtml(record)}
    <p style="margin:24px 0 12px;font-weight:bold;">Ügyfél adatai:</p>
    ${adatTablaHtml(record)}
    <p style="margin:20px 0 0;">
      <a href="mailto:${esc(record.email)}" style="display:inline-block;background:${MARKA};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;font-size:14px;">Válasz az ügyfélnek</a>
    </p>`;

    const text = `ÚJ ÁRAJÁNLATKÉRÉS
${record.vanEgyediArazas ? '\n!!! EGYEDI ÁRAZÁS SZÜKSÉGES — a végösszeg nem számolható automatikusan !!!\n' : ''}
Ingatlan jellege: ${jelleg}
Azonosító: ${record.id}

Árajánlat tételei:
${arTablaText(record)}

Ügyfél adatai:
${adatTablaText(record)}`;

    return {
        subject: `${record.vanEgyediArazas ? '[EGYEDI ÁRAZÁS] ' : ''}Új árajánlatkérés — ${record.nev} (${jelleg})`,
        html: keret('Új árajánlatkérés', html),
        text
    };
}

/** 3. ág — napi limit túllépése. Kizárólag az üzemeltetőnek megy ki. */
export function ismeteltKiserletErtesito(record: QuoteRecord, exactAttempt: boolean): EmailTorzs {
    const sorszam = exactAttempt ? `${record.attemptNumber}.` : `kb. ${record.attemptNumber}.`;

    const html = `
    <p style="margin:0 0 16px;font-size:17px;font-weight:bold;color:#b45309;">Ismételt árajánlatkérés — a napi limit blokkolta</p>
    <p style="margin:0 0 20px;">
      Az alábbi ügyfél ma <strong>${esc(sorszam)}</strong> alkalommal próbált árajánlatot kérni.
      Az ügyfél <strong>nem kapott</strong> levelet, csak a felületen látta a tájékoztatást.
      ${exactAttempt ? '' : '<br><span style="color:' + HALVANY + ';font-size:13px;">A sorszám becsült: a számláló frissítése versenyhelyzetbe ütközött.</span>'}
    </p>
    ${adatTablaHtml(record)}
    <p style="margin:20px 0 0;">
      <a href="mailto:${esc(record.email)}" style="display:inline-block;background:${MARKA};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;font-size:14px;">Kapcsolatfelvétel az ügyféllel</a>
    </p>`;

    const text = `ISMÉTELT ÁRAJÁNLATKÉRÉS — A NAPI LIMIT BLOKKOLTA

Az ügyfél ma ${sorszam} alkalommal próbált árajánlatot kérni.
Az ügyfél NEM kapott levelet.${exactAttempt ? '' : '\nA sorszám becsült: a számláló frissítése versenyhelyzetbe ütközött.'}

${adatTablaText(record)}`;

    return {
        subject: `Ismételt árajánlatkérés — ${record.nev} (${sorszam} kísérlet ma)`,
        html: keret('Ismételt árajánlatkérés', html),
        text
    };
}
