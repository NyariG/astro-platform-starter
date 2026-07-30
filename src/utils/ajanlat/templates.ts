import { HOTERMELOK, HUTES_OPCIOK, INGATLAN_JELLEG, MENNYEZET_HUTES, SZOLGALTATAS_OPCIOK, TERV_CELJA, labelOf, labelsOf } from './options';
import { forint, negyzetmeter } from './format';
import { JOGI_ROVID } from './legal-notice';
import type { QuoteRecord } from './store';

function jogiLevelHtml(): string {
    return `<p style="margin:20px 0 0;padding-top:16px;border-top:1px solid ${KERET};color:${HALVANY};font-size:12px;line-height:1.5;">${esc(JOGI_ROVID)}</p>`;
}

function jogiLevelText(): string {
    return `\n${JOGI_ROVID}`;
}

const MARKA = '#2563eb';
const SZOVEG = '#0f172a';
const HALVANY = '#64748b';
const KERET = '#e2e8f0';
const HATTER = '#f8fafc';
const BANNER_URL = 'https://nyariterv.hu/images/nyariterv-banner.png';
const FOOTER_URL = 'https://nyariterv.hu/images/nyariterv-ikonok.png';

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

function keret(cim: string, torzsHtml: string, elonezet = ''): string {
    return `<!doctype html>
<html lang="hu">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(cim)}</title></head>
<body style="margin:0;padding:0;background:${HATTER};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${esc(elonezet || cim)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${HATTER};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${KERET};border-radius:14px;overflow:hidden;font-family:'Segoe UI',Arial,Helvetica,sans-serif;box-shadow:0 1px 3px rgba(15,23,42,0.06);">
          <tr>
            <td style="padding:0;font-size:0;line-height:0;">
              <img src="${BANNER_URL}" width="600" alt="Nyári-Terv — épületgépészeti tervezés" style="display:block;width:100%;max-width:600px;height:auto;border:0;">
            </td>
          </tr>
          <tr><td style="height:4px;line-height:4px;font-size:0;background:${MARKA};">&nbsp;</td></tr>
          <tr><td style="padding:28px 30px;color:${SZOVEG};font-size:15px;line-height:1.65;">${torzsHtml}</td></tr>
          <tr>
            <td style="padding:18px 30px;border-top:1px solid ${KERET};background:${HATTER};color:${HALVANY};font-size:12px;line-height:1.6;">
              <strong style="color:${SZOVEG};">Nyári Terv</strong> — épületgépészeti tervezés<br>
              <a href="mailto:info@nyariterv.hu" style="color:${MARKA};text-decoration:none;">info@nyariterv.hu</a> &nbsp;·&nbsp;
              <a href="tel:+36703187843" style="color:${MARKA};text-decoration:none;">+36 70 318 7843</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:14px 30px 20px;background:${HATTER};">
              <img src="${FOOTER_URL}" width="190" alt="Nyári-Terv" style="display:inline-block;width:190px;max-width:60%;height:auto;border:0;">
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function osszefoglaloHtml(record: QuoteRecord): string {
    const jelleg = labelOf(INGATLAN_JELLEG, record.ingatlanJelleg);
    const szolg = labelsOf(SZOLGALTATAS_OPCIOK, record.szolgaltatasok).join(', ');
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${HATTER};border:1px solid ${KERET};border-radius:10px;">
      <tr><td style="padding:14px 18px;font-size:14px;color:${SZOVEG};line-height:1.8;">
        <span style="color:${HALVANY};">Ingatlan jellege:</span> <strong>${esc(jelleg)}</strong><br>
        <span style="color:${HALVANY};">Kért szolgáltatások:</span> <strong>${esc(szolg)}</strong>
      </td></tr>
    </table>`;
}

function osszefoglaloText(record: QuoteRecord): string {
    const jelleg = labelOf(INGATLAN_JELLEG, record.ingatlanJelleg);
    const szolg = labelsOf(SZOLGALTATAS_OPCIOK, record.szolgaltatasok).join(', ');
    return `Ingatlan jellege: ${jelleg}\nKért szolgáltatások: ${szolg}`;
}

function lakoepuletUgyfelTorzs(record: QuoteRecord, vanPdf: boolean): { html: string; text: string } {
    const pdfBlokkHtml = vanPdf
        ? '<strong>A részletes árajánlatot PDF-ben mellékeltük</strong> ehhez a levélhez.'
        : 'Az elkészült részletes árajánlatot tervezőnk hamarosan megküldi Önnek.';
    const pdfBlokkText = vanPdf ? 'A részletes árajánlatot PDF-ben mellékeltük ehhez a levélhez.' : 'Az elkészült részletes árajánlatot tervezőnk hamarosan megküldi Önnek.';
    const html = `
    <p style="margin:0 0 16px;font-size:16px;">Kedves ${esc(record.nev)}!</p>
    <p style="margin:0 0 18px;">
      Köszönjük, hogy a Nyári Tervet választotta. Árajánlatkérését megkaptuk, és a megadott
      paraméterek alapján összeállítottuk az Ön személyre szabott árajánlatát.
    </p>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:#eff6ff;border:1px solid #dbeafe;border-radius:10px;margin:0 0 22px;">
      <tr><td style="padding:16px 18px;font-size:14px;color:${SZOVEG};line-height:1.6;">
        ${pdfBlokkHtml}
      </td></tr>
    </table>
    <p style="margin:0 0 10px;font-weight:700;color:${SZOVEG};">Az Ön kérése röviden</p>
    ${osszefoglaloHtml(record)}
    <p style="margin:22px 0 18px;">
      <strong>Következő lépés:</strong> tervezőnk a megadott elérhetőségen hamarosan felveszi Önnel
      a kapcsolatot az árajánlat véglegesítése és a részletek egyeztetése céljából.
    </p>
    ${jogiLevelHtml()}
    <p style="margin:20px 0 0;color:${HALVANY};font-size:13px;">
      Kérdése van? Válaszoljon erre a levélre, vagy hívjon minket a
      <a href="tel:+36703187843" style="color:${MARKA};text-decoration:none;">+36 70 318 7843</a> számon.
    </p>`;

    const text = `Kedves ${record.nev}!

Köszönjük, hogy a Nyári Tervet választotta. Árajánlatkérését megkaptuk, és a megadott paraméterek alapján összeállítottuk az Ön személyre szabott árajánlatát.

${pdfBlokkText}

Az Ön kérése röviden:
${osszefoglaloText(record)}

Következő lépés: tervezőnk a megadott elérhetőségen hamarosan felveszi Önnel a kapcsolatot az árajánlat véglegesítése és a részletek egyeztetése céljából.
${jogiLevelText()}

Kérdése van? Válaszoljon erre a levélre, vagy hívjon minket a +36 70 318 7843 számon.

Nyári Terv — épületgépészeti tervezés
info@nyariterv.hu · +36 70 318 7843`;

    return { html, text };
}

export function lakoepuletUgyfelLevel(record: QuoteRecord, vanPdf = true): EmailTorzs {
    const { html, text } = lakoepuletUgyfelTorzs(record, vanPdf);
    return {
        subject: 'Az Ön árajánlata — Nyári Terv',
        html: keret('Az Ön árajánlata', html, `${record.nev}, elkészült az árajánlata${vanPdf ? ' — a részletek a mellékelt PDF-ben' : ''}.`),
        text
    };
}

export function altalanosUgyfelLevel(record: QuoteRecord): EmailTorzs {
    const html = `
    <p style="margin:0 0 16px;font-size:16px;">Kedves ${esc(record.nev)}!</p>
    <p style="margin:0 0 16px;">
      Köszönjük, hogy a Nyári Tervet választotta, és bizalmával megtisztelt bennünket. Megkeresését megkaptuk.
    </p>
    <p style="margin:0 0 18px;">
      Az ipari és egyedi jellegű projektek minden esetben személyre szabott tervezői megközelítést igényelnek,
      ezért ezekre az igények alapos felmérését követően, egyedi árajánlattal válaszolunk.
    </p>
    <p style="margin:0 0 10px;font-weight:700;color:${SZOVEG};">Az Ön kérése röviden</p>
    ${osszefoglaloHtml(record)}
    <p style="margin:22px 0 18px;">
      <strong>Következő lépés:</strong> kollégánk a megadott elérhetőségen hamarosan felveszi Önnel a kapcsolatot,
      hogy egyeztessük a részleteket, és összeállítsuk az Ön projektjére szabott ajánlatot.
    </p>
    ${jogiLevelHtml()}
    <p style="margin:20px 0 0;color:${HALVANY};font-size:13px;">
      Kérdése van? Válaszoljon erre a levélre, vagy hívjon minket a
      <a href="tel:+36703187843" style="color:${MARKA};text-decoration:none;">+36 70 318 7843</a> számon.
    </p>`;

    const text = `Kedves ${record.nev}!

Köszönjük, hogy a Nyári Tervet választotta, és bizalmával megtisztelt bennünket. Megkeresését megkaptuk.

Az ipari és egyedi jellegű projektek minden esetben személyre szabott tervezői megközelítést igényelnek, ezért ezekre az igények alapos felmérését követően, egyedi árajánlattal válaszolunk.

Az Ön kérése röviden:
${osszefoglaloText(record)}

Következő lépés: kollégánk a megadott elérhetőségen hamarosan felveszi Önnel a kapcsolatot, hogy egyeztessük a részleteket, és összeállítsuk az Ön projektjére szabott ajánlatot.
${jogiLevelText()}

Kérdése van? Válaszoljon erre a levélre, vagy hívjon minket a +36 70 318 7843 számon.

Nyári Terv — épületgépészeti tervezés
info@nyariterv.hu · +36 70 318 7843`;

    return {
        subject: 'Megkeresését rögzítettük — Nyári Terv',
        html: keret('Megkeresését rögzítettük', html, `${record.nev}, megkaptuk a megkeresését — kollégánk hamarosan jelentkezik.`),
        text
    };
}

/** Üzemeltetői adatlap — mindkét sikeres ágban ez megy ki. */
function kapcsolatBlokkHtml(record: QuoteRecord): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;background:${HATTER};border:1px solid ${KERET};border-radius:10px;margin:0 0 16px;">
      <tr><td style="padding:16px 18px;font-size:14px;color:${SZOVEG};line-height:1.8;">
        <strong style="font-size:16px;">${esc(record.nev)}</strong><br>
        <a href="mailto:${esc(record.email)}" style="color:${MARKA};text-decoration:none;">${esc(record.email)}</a>${record.telefon ? ` &nbsp;·&nbsp; <a href="tel:${esc(record.telefon)}" style="color:${MARKA};text-decoration:none;">${esc(record.telefon)}</a>` : ''} &nbsp;·&nbsp; ${esc(record.varos)}
      </td></tr>
    </table>
    <p style="margin:0 0 16px;">
      <a href="mailto:${esc(record.email)}" style="display:inline-block;background:${MARKA};color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:8px;font-weight:700;font-size:14px;line-height:1;">Válasz az ügyfélnek</a>
    </p>`;
}

export function uzemeltetoiAdatlap(record: QuoteRecord): EmailTorzs {
    const jelleg = labelOf(INGATLAN_JELLEG, record.ingatlanJelleg);

    const html = `
    <p style="margin:0 0 6px;font-size:18px;font-weight:800;color:${SZOVEG};">Új árajánlatkérés érkezett</p>
    <p style="margin:0 0 18px;color:${HALVANY};font-size:13px;">${esc(jelleg)} · Azonosító: <code style="font-size:12px;">${esc(record.id)}</code></p>
    ${record.vanEgyediArazas ? `<p style="margin:0 0 18px;padding:12px 16px;background:#fef3c7;border-left:4px solid #b45309;color:${SZOVEG};font-size:14px;font-weight:700;border-radius:0 8px 8px 0;">Egyedi árazás szükséges — a végösszeg nem számolható automatikusan.</p>` : ''}
    ${kapcsolatBlokkHtml(record)}
    <p style="margin:0 0 10px;font-weight:700;color:${SZOVEG};">Árajánlat tételei (pontos)</p>
    ${arTablaHtml(record)}
    <p style="margin:24px 0 10px;font-weight:700;color:${SZOVEG};">Projekt-adatok</p>
    ${adatTablaHtml(record)}
    <p style="margin:20px 0 0;color:${HALVANY};font-size:12px;line-height:1.6;">Forrás: ${esc(record.sourceUrl)}</p>`;

    const text = `ÚJ ÁRAJÁNLATKÉRÉS — ${jelleg}
Azonosító: ${record.id}${record.vanEgyediArazas ? '\n\n!!! EGYEDI ÁRAZÁS SZÜKSÉGES — a végösszeg nem számolható automatikusan !!!' : ''}

Ügyfél: ${record.nev}
E-mail: ${record.email}${record.telefon ? `\nTelefon: ${record.telefon}` : ''}
Település: ${record.varos}

Árajánlat tételei (pontos):
${arTablaText(record)}

Projekt-adatok:
${adatTablaText(record)}

Forrás: ${record.sourceUrl}`;

    return {
        subject: `${record.vanEgyediArazas ? '[EGYEDI ÁRAZÁS] ' : ''}Új árajánlatkérés — ${record.nev} (${jelleg})`,
        html: keret('Új árajánlatkérés', html, `${record.nev} · ${jelleg}${record.vanEgyediArazas ? ' · EGYEDI ÁRAZÁS' : ''}`),
        text
    };
}

export function ugyfelHibaErtesito(record: QuoteRecord, hibaUzenet: string): EmailTorzs {
    const html = `
    <p style="margin:0 0 14px;font-size:17px;font-weight:800;color:#b91c1c;">Az ügyfél visszaigazoló levele NEM ment ki</p>
    <p style="margin:0 0 18px;">A megkeresés rögzült, és az árajánlat elkészült, de az ügyfélnek szánt levél kézbesítése hibázott. Kérjük, vedd fel manuálisan a kapcsolatot.</p>
    ${kapcsolatBlokkHtml(record)}
    <p style="margin:16px 0 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #b91c1c;color:${SZOVEG};font-size:13px;line-height:1.6;border-radius:0 8px 8px 0;"><strong>Hiba:</strong> ${esc(hibaUzenet)}</p>`;

    const text = `AZ ÜGYFÉL VISSZAIGAZOLÓ LEVELE NEM MENT KI

A megkeresés rögzült, de az ügyfélnek szánt levél hibázott. Kérjük, vedd fel manuálisan a kapcsolatot.

Ügyfél: ${record.nev}
E-mail: ${record.email}${record.telefon ? `\nTelefon: ${record.telefon}` : ''}
Település: ${record.varos}

Hiba: ${hibaUzenet}`;

    return {
        subject: `[HIBA] Az ügyfél levele nem ment ki — ${record.nev}`,
        html: keret('Ügyfél-levél hiba', html, `Az ügyfél visszaigazoló levele nem ment ki — ${record.nev}`),
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
