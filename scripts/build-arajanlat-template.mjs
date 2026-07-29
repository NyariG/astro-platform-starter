import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PizZip from 'pizzip';
import sharp from 'sharp';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = path.join(ROOT, 'src/contracts/arajanlat_sablon.docx');
const OUT_DIR = path.join(ROOT, 'src/utils/ajanlat/pdf');
const KEP_SZELESSEG = 1200;

const tagBekezdes = (tag) => `<w:p><w:r><w:t xml:space="preserve">${tag}</w:t></w:r></w:p>`;
const tagRun = (tag) => `<w:r><w:t xml:space="preserve">${tag}</w:t></w:r>`;

const CELLA_RPR = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Arial" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:kern w:val="0"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:eastAsia="hu-HU"/></w:rPr>';
const CELLA_RPR_B = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="Arial" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:b/><w:bCs/><w:kern w:val="0"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:eastAsia="hu-HU"/></w:rPr>';
const cella = (w, rpr, tartalom) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:tcMar><w:top w:w="40" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tcMar><w:vAlign w:val="center"/></w:tcPr><w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>${rpr}</w:pPr><w:r>${rpr}<w:t xml:space="preserve">${tartalom}</w:t></w:r></w:p></w:tc>`;
const RESZLETEK_TABLA =
    '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders>' +
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((b) => `<w:${b} w:val="single" w:sz="4" w:space="0" w:color="D9D9D9"/>`).join('') +
    '</w:tblBorders><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>' +
    '<w:tblGrid><w:gridCol w:w="3402"/><w:gridCol w:w="5920"/></w:tblGrid>' +
    '<w:tr>' +
    cella('3402', CELLA_RPR_B, '[#reszletek][cimke]') +
    cella('5920', CELLA_RPR, '[ertek][/reszletek]') +
    '</w:tr></w:tbl><w:p/>';

const LOOPS = [
    { token: '[TOVABBI_KIVITELEZESI_TERVEK]', open: '[#tovabbi]', close: '[/tovabbi]' },
    { token: '[EGYEB_KIVITELEZESI_TERVEK]', open: '[#egyeb]', close: '[/egyeb]' },
    { token: '[KERT_KONCEPCIO_TERVEK]', open: '[#kertKoncepcio]', close: '[/kertKoncepcio]' },
    { token: '[KERT_KIVITELEZESI_TERVEK]', open: '[#kertKiviteles]', close: '[/kertKiviteles]' },
    { token: '[AUTOMATA_ONTOZORENDSZER_TERVEK]', open: '[#ontozo]', close: '[/ontozo]' }
];

function stripFt(p) {
    return p.replace(/<w:t[^>]*>,-<\/w:t>/, '<w:t></w:t>').replace(/<w:t[^>]*> Ft ?<\/w:t>/, '<w:t xml:space="preserve"> </w:t>');
}

const VEGOSSZEG_ENERGETIKA_CIMKE = 'Végösszeg (Energetikai tanúsítvánnyal kalkulált összeg) ';

function paraSzoveg(para) {
    let s = '';
    for (const m of para.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)) s += m[1];
    return s;
}

function egyesitRunok(para) {
    const teljes = paraSzoveg(para);
    let elso = true;
    return para.replace(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/g, () => {
        if (elso) {
            elso = false;
            return `<w:t xml:space="preserve">${teljes}</w:t>`;
        }
        return '<w:t xml:space="preserve"></w:t>';
    });
}

function stripFtSzoveg(p) {
    return p.replace(/,-\s*Ft/, '');
}

function transzformaljBekezdes(para) {
    if (para.includes('[RESZLETEK]')) return RESZLETEK_TABLA;

    if (para.includes('[MUSZAKI_LEIRAS]')) {
        const p = para.replace('[MUSZAKI_LEIRAS]', '[#muszakiVan][MUSZAKI_LEIRAS]');
        return p.replace(/<\/w:p>$/, tagRun('[/muszakiVan]') + '</w:p>');
    }

    if (para.includes('[KERTTEL_KAPCSOLATOS_TERVEK]')) {
        return para.replace('[KERTTEL_KAPCSOLATOS_TERVEK]', '[#kertVan][KERTTEL_KAPCSOLATOS_TERVEK][/kertVan]');
    }

    for (const L of LOOPS) {
        if (para.includes(L.token)) {
            let p = para.replace(L.token, '[nev]');
            p = stripFt(p);
            return tagBekezdes(L.open) + p + tagBekezdes(L.close);
        }
    }

    const szoveg = paraSzoveg(para);

    if (szoveg.includes('[KUPON_KEDVEZMENY]')) {
        let p = stripFtSzoveg(egyesitRunok(para));
        p = p.replace('[KUPON_KEDVEZMENY]', '[#kuponVan][KUPON_KEDVEZMENY]');
        p = p.replace('[KUPON_KEDVEZMENY_ARA]', '[KUPON_KEDVEZMENY_ARA][/kuponVan]');
        return p;
    }

    if (szoveg.includes('[VEGOSSZEG_ARA_ENERGETIKAVAL]')) {
        const p = stripFtSzoveg(egyesitRunok(para));
        return p.replace('[VEGOSSZEG_ARA_ENERGETIKAVAL]', `${VEGOSSZEG_ENERGETIKA_CIMKE}[VEGOSSZEG_ARA_ENERGETIKAVAL]`);
    }

    if (szoveg.includes('[VEGOSSZEG_ARA_ENERGETIKA_NELKUL]')) {
        const p = stripFtSzoveg(egyesitRunok(para));
        return p.replace('Végösszeg[VEGOSSZEG_ARA_ENERGETIKA_NELKUL]', 'Végösszeg [VEGOSSZEG_ARA_ENERGETIKA_NELKUL]');
    }

    return para;
}

function transzformaljXml(xml) {
    const re = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let last = 0;
    let m;
    let out = '';
    while ((m = re.exec(xml))) {
        out += xml.slice(last, m.index);
        out += transzformaljBekezdes(m[0]);
        last = re.lastIndex;
    }
    out += xml.slice(last);
    return out;
}

async function main() {
    if (!fs.existsSync(SRC)) {
        console.error(`Hiányzik a nyers sablon: ${SRC}`);
        process.exit(1);
    }

    const zip = new PizZip(fs.readFileSync(SRC));

    const eredetiXml = zip.file('word/document.xml').asText();
    zip.file('word/document.xml', transzformaljXml(eredetiXml));

    for (const nev of ['word/media/image2.png', 'word/media/image3.png']) {
        const fajl = zip.file(nev);
        if (!fajl) continue;
        const eredeti = fajl.asNodeBuffer();
        const optimalizalt = await sharp(eredeti)
            .resize({ width: KEP_SZELESSEG, withoutEnlargement: true })
            .png({ compressionLevel: 9, palette: true })
            .toBuffer();
        zip.file(nev, optimalizalt);
        console.log(`  ${nev}: ${(eredeti.length / 1e6).toFixed(2)} MB → ${(optimalizalt.length / 1e6).toFixed(2)} MB`);
    }

    const kimenet = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'template.docx'), kimenet);

    const b64 = kimenet.toString('base64');
    const modul = `export const SABLON_B64 =\n    '${b64}';\n`;
    fs.writeFileSync(path.join(OUT_DIR, 'template-b64.ts'), modul);

    console.log(`  template.docx: ${(kimenet.length / 1e6).toFixed(2)} MB`);
    console.log(`  template-b64.ts: ${(modul.length / 1e6).toFixed(2)} MB`);
    console.log('Kész.');
}

main();
