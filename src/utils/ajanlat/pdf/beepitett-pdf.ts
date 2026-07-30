import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { QuoteRecord } from '../store';
import { ENERGETIKAI_TANUSITVANY_DIJ } from '../pricing-config';
import { buildTemplateData } from './adatszerzodes';
import { ezresPont } from './format';
import { DEJAVU_BOLD_B64, DEJAVU_REGULAR_B64 } from './dejavu-b64';
import { BANNER_B64 } from './banner-b64';

const A4: [number, number] = [595.28, 841.89];
const M = 50;
const CW = A4[0] - 2 * M;

const SZOVEG = rgb(0.09, 0.13, 0.24);
const HALVANY = rgb(0.42, 0.47, 0.53);
const MARKA = rgb(0.145, 0.388, 0.922);
const KERET = rgb(0.85, 0.86, 0.88);

const TARTALMAZZA = ['műszaki konzultációt', 'hőtechnikai számításokat (fűtéshez-hűtéshez)', 'alaprajzi tervet', 'függőleges csőtervet', 'kapcsolási rajzot', 'árazatlan költségvetést', 'műszaki leírást'];
const NEM_TARTALMAZZA = ['vezérlés/automatika (gyengeáram) terveit', 'közmű csatlakozások terveit', 'víz-csatorna közművek engedélyeztetési eljárását', 'esővíz elvezetés terveit'];
const HATARIDOK = [
    'Tervezés várható időtartama: A megrendeléstől, illetve a végleges adatszolgáltatástól számított kb. 3 munkahét.',
    'Előleg: A tervezési munka megrendelése 30%-os előleg kifizetéssel véglegesíthető.',
    'Átadás: Az elkészült tervek a végszámla kiegyenlítését követően, elektronikusan átadásra kerülnek.'
];
const ENERGETIKAI = `Energetikai tanúsítvány használatbavételi engedélyhez — ${ezresPont(ENERGETIKAI_TANUSITVANY_DIJ)},- Ft (Az ár a tervezés megrendelése esetén érvényes a tervek leadásától számított maximum 2 évig.)`;

function b64(s: string): Uint8Array {
    return new Uint8Array(Buffer.from(s, 'base64'));
}

function arOf(item: Record<string, string>): string {
    const be = Object.entries(item).find(([k]) => k !== 'nev');
    return be ? be[1] : '';
}

type Allapot = { doc: PDFDocument; reg: PDFFont; bold: PDFFont; page: PDFPage; y: number };

function ujOldal(a: Allapot): void {
    a.page = a.doc.addPage(A4);
    a.y = A4[1] - M;
}

function hely(a: Allapot, kell: number): void {
    if (a.y - kell < M) ujOldal(a);
}

function tordel(text: string, font: PDFFont, size: number, maxW: number): string[] {
    const sorok: string[] = [];
    for (const bekezdes of text.split('\n')) {
        const szavak = bekezdes.split(' ');
        let cur = '';
        for (const w of szavak) {
            const test = cur ? `${cur} ${w}` : w;
            if (cur && font.widthOfTextAtSize(test, size) > maxW) {
                sorok.push(cur);
                cur = w;
            } else {
                cur = test;
            }
        }
        sorok.push(cur);
    }
    return sorok.length ? sorok : [''];
}

type SorOpc = { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; indent?: number; gap?: number; width?: number };

function sor(a: Allapot, text: string, opc: SorOpc = {}): void {
    const font = opc.font ?? a.reg;
    const size = opc.size ?? 10;
    const color = opc.color ?? SZOVEG;
    const indent = opc.indent ?? 0;
    const x = M + indent;
    const width = opc.width ?? CW - indent;
    const lh = size * 1.4;
    for (const ln of tordel(text, font, size, width)) {
        hely(a, lh);
        a.page.drawText(ln, { x, y: a.y - size, size, font, color });
        a.y -= lh;
    }
    a.y -= opc.gap ?? 0;
}

function cimsor(a: Allapot, text: string): void {
    a.y -= 6;
    sor(a, text, { font: a.bold, size: 12, color: SZOVEG, gap: 4 });
}

type TetelOpc = { indent?: number; font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> };

function tetelSor(a: Allapot, nev: string, ar: string, opc: TetelOpc = {}): void {
    const size = opc.size ?? 10;
    const font = opc.font ?? a.reg;
    const color = opc.color ?? SZOVEG;
    const indent = opc.indent ?? 0;
    const arW = font.widthOfTextAtSize(ar, size);
    const nevW = CW - indent - arW - 14;
    const sorok = tordel(nev, font, size, nevW);
    const lh = size * 1.4;
    hely(a, sorok.length * lh);
    for (let i = 0; i < sorok.length; i++) {
        a.page.drawText(sorok[i], { x: M + indent, y: a.y - size, size, font, color });
        if (i === 0 && ar) a.page.drawText(ar, { x: M + CW - arW, y: a.y - size, size, font, color });
        a.y -= lh;
    }
}

function tablaSor(a: Allapot, cimke: string, ertek: string): void {
    const size = 9;
    const c1 = M + 8;
    const oszlop = 175;
    const w1 = oszlop - 16;
    const w2 = CW - oszlop - 12;
    const l1 = tordel(cimke, a.bold, size, w1);
    const l2 = tordel(ertek, a.reg, size, w2);
    const magas = Math.max(l1.length, l2.length) * (size * 1.35) + 8;
    hely(a, magas);
    a.page.drawRectangle({ x: M, y: a.y - magas, width: CW, height: magas, borderColor: KERET, borderWidth: 0.5 });
    a.page.drawLine({ start: { x: M + oszlop, y: a.y }, end: { x: M + oszlop, y: a.y - magas }, thickness: 0.5, color: KERET });
    let y1 = a.y - size - 4;
    for (const l of l1) {
        a.page.drawText(l, { x: c1, y: y1, size, font: a.bold, color: SZOVEG });
        y1 -= size * 1.35;
    }
    let y2 = a.y - size - 4;
    for (const l of l2) {
        a.page.drawText(l, { x: M + oszlop + 8, y: y2, size, font: a.reg, color: SZOVEG });
        y2 -= size * 1.35;
    }
    a.y -= magas;
}

export async function keszitsBeepitettPdf(record: QuoteRecord): Promise<Uint8Array> {
    const adat = buildTemplateData(record);
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const reg = await doc.embedFont(b64(DEJAVU_REGULAR_B64), { subset: true });
    const bold = await doc.embedFont(b64(DEJAVU_BOLD_B64), { subset: true });
    const a: Allapot = { doc, reg, bold, page: doc.addPage(A4), y: A4[1] - M };

    const bannerKep = await doc.embedPng(b64(BANNER_B64));
    const bannerH = (CW * bannerKep.height) / bannerKep.width;
    a.page.drawImage(bannerKep, { x: M, y: A4[1] - M - bannerH, width: CW, height: bannerH });
    a.y = A4[1] - M - bannerH - 10;
    a.page.drawLine({ start: { x: M, y: a.y }, end: { x: M + CW, y: a.y }, thickness: 1.5, color: MARKA });
    a.y -= 20;

    sor(a, `Tisztelt ${adat.UGYFELNEV}!`, { size: 11, gap: 6 });
    sor(a, 'Köszönöm a megkeresését. Az Ön által megadott paraméterek alapján az alábbi részletes árajánlatot állítottam össze:', { gap: 8 });

    cimsor(a, '1. Az ajánlatkérés összefoglalása (Projekt leírása)');
    sor(a, `Az ajánlatkérés tárgya egy ${adat.SZINTEK_SZAMA}, összesen kb. ${adat.NEGYZETMETER_ERTEK} m² alapterületű ${adat.INGATLAN_JELLEGE} gépészeti tervezése az alábbiak szerint:`, { gap: 8 });
    for (const s of adat.reszletek) tablaSor(a, s.cimke, s.ertek);
    a.y -= 6;

    cimsor(a, '2. Tervezési opciók és díjak');
    if (adat.muszakiVan) {
        tetelSor(a, adat.MUSZAKI_LEIRAS, `${adat.MUSZAKI_LEIRAS_ARA},- Ft`);
        if (adat.RESZLETEZO_SZOVEG.trim()) sor(a, adat.RESZLETEZO_SZOVEG.trim(), { size: 8.5, color: HALVANY, indent: 8, gap: 2 });
    }
    for (const t of adat.tovabbi) tetelSor(a, t.nev, arOf(t));
    for (const e of adat.egyeb) tetelSor(a, e.nev, arOf(e));
    if (adat.kertVan) {
        a.y -= 4;
        sor(a, adat.KERTTEL_KAPCSOLATOS_TERVEK, { font: bold, size: 10, gap: 2 });
        for (const k of adat.kertKoncepcio) tetelSor(a, k.nev, arOf(k), { indent: 12 });
        for (const k of adat.kertKiviteles) tetelSor(a, k.nev, arOf(k), { indent: 12 });
        for (const o of adat.ontozo) {
            tetelSor(a, o.nev, arOf(o), { indent: 12 });
            sor(a, '(kizárólag a ténylegesen öntözendő felület négyzetmétere alapján számolva)', { size: 8.5, color: HALVANY, indent: 12, gap: 2 });
        }
    }

    hely(a, 150);
    if (adat.kuponVan) {
        a.y -= 4;
        tetelSor(a, adat.KUPON_KEDVEZMENY, adat.KUPON_KEDVEZMENY_ARA, { color: HALVANY });
    }
    a.y -= 4;
    sor(a, 'Egyéb kiegészítő tervezési opciók', { font: bold, size: 10, gap: 2 });
    sor(a, ENERGETIKAI, { size: 9, color: HALVANY, gap: 8 });

    a.page.drawLine({ start: { x: M, y: a.y + 2 }, end: { x: M + CW, y: a.y + 2 }, thickness: 1, color: KERET });
    a.y -= 10;
    tetelSor(a, 'Végösszeg', adat.VEGOSSZEG_ARA_ENERGETIKA_NELKUL, { font: bold, size: 12 });
    tetelSor(a, 'Végösszeg (Energetikai tanúsítvánnyal kalkulált összeg)', adat.VEGOSSZEG_ARA_ENERGETIKAVAL, { font: bold, size: 12 });
    a.y -= 8;

    sor(a, 'Az ajánlat tartalmazza (bővített opció esetén):', { font: bold, size: 10, gap: 2 });
    for (const s of TARTALMAZZA) sor(a, `•  ${s}`, { size: 9, indent: 6 });
    a.y -= 4;
    sor(a, 'Az ajánlat NEM tartalmazza:', { font: bold, size: 10, gap: 2 });
    for (const s of NEM_TARTALMAZZA) sor(a, `•  ${s}`, { size: 9, indent: 6 });
    a.y -= 6;

    cimsor(a, '3. Határidők és fizetési feltételek');
    for (const s of HATARIDOK) sor(a, `•  ${s}`, { size: 9, indent: 6 });
    a.y -= 6;
    sor(a, 'Az árajánlat a kiállítástól számított 3 hónapig érvényes.', { size: 9, color: HALVANY });
    sor(a, 'Az ajánlat alanyi adómentes.', { size: 9, color: HALVANY, gap: 14 });

    sor(a, `Abda, ${adat.AKTUALIS_DATUM}`, { gap: 20 });
    sor(a, '_______________________', { color: HALVANY });
    sor(a, 'Nyári Gergő Mátyás', { font: bold });
    sor(a, 'Gépészmérnök', { color: HALVANY });

    return doc.save();
}
