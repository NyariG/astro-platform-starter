import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const TEMPLATE = path.join(ROOT, 'src/utils/ajanlat/pdf/template.docx');
const OUT_DIR = path.join(ROOT, 'scripts/.out');
const API = 'https://api.cloudconvert.com/v2';

const apiKey = process.env.CLOUDCONVERT_API_KEY;
if (!apiKey) {
    console.error('Hiányzik a CLOUDCONVERT_API_KEY környezeti változó.');
    process.exit(1);
}

const ADAT = {
    UGYFELNEV: 'Kovács Anna',
    SZINTEK_SZAMA: 'kétszintes',
    NEGYZETMETER_ERTEK: '145',
    INGATLAN_JELLEGE: 'lakóépület',
    RESZLETEK: 'Új építésű ingatlan épületgépészeti tervezése a kiválasztott opciók szerint.',
    AKTUALIS_DATUM: '2026. július 25.',
    muszakiVan: true,
    MUSZAKI_LEIRAS_ARA: '60.000,- Ft',
    tovabbiVan: true,
    tovabbi: [
        { nev: 'Fűtési terv', TOVABBI_KIVITELEZESI_TERVEK_ARAI: '230.000,- Ft' },
        { nev: 'Hőtermelő felár (2 db)', TOVABBI_KIVITELEZESI_TERVEK_ARAI: '60.000,- Ft' },
        { nev: 'Klímaterv', TOVABBI_KIVITELEZESI_TERVEK_ARAI: '50.000,- Ft' }
    ],
    egyeb: [{ nev: 'Esővíz szikkasztási terv', EGYEB_KIVITELEZESI_TERVEK_ARAI: '100.000,- Ft' }],
    kertVan: true,
    kertKoncepcio: [{ nev: 'Kertépítés — koncepcióterv', KERT_KONCEPCIO_TERVEK_ARAI: '100.000,- Ft' }],
    kertKiviteles: [{ nev: 'Kertépítés — kiviteli terv', KERT_KIVITELEZESI_TERVEK_ARAI: '300.000,- Ft' }],
    ontozo: [{ nev: 'Automata öntözőrendszer kivitelezési terv', AUTOMATA_ONTOZORENDSZER_TERVEK_ARAI: 'egyedi árajánlat szerint' }]
};

const alszik = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {

    const zip = new PizZip(fs.readFileSync(TEMPLATE));
    const doc = new Docxtemplater(zip, { delimiters: { start: '[', end: ']' }, paragraphLoop: true, linebreaks: true, nullGetter: () => '' });
    doc.render(ADAT);
    const docx = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'proba-arajanlat.docx'), docx);
    console.log('Kitöltött DOCX kész. Konverzió CloudConverttel…');

    const t0 = Date.now();
    const jobRes = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tasks: {
                'import-doc': { operation: 'import/base64', file: docx.toString('base64'), filename: 'arajanlat.docx' },
                'convert-pdf': { operation: 'convert', input: 'import-doc', input_format: 'docx', output_format: 'pdf', engine: 'libreoffice' },
                'export-pdf': { operation: 'export/url', input: 'convert-pdf' }
            }
        })
    });
    if (!jobRes.ok) {
        console.error('Job létrehozása sikertelen:', jobRes.status, await jobRes.text());
        process.exit(1);
    }
    const jobId = (await jobRes.json()).data.id;

    // 3. Várakozás.
    let url = null;
    while (Date.now() - t0 < 60000) {
        await alszik(1500);
        const st = await (await fetch(`${API}/jobs/${jobId}`, { headers: { Authorization: `Bearer ${apiKey}` } })).json();
        if (st.data.status === 'error') {
            console.error('Konverziós hiba:', JSON.stringify(st.data.tasks.map((t) => ({ op: t.operation, status: t.status, msg: t.message })), null, 2));
            process.exit(1);
        }
        if (st.data.status === 'finished') {
            url = st.data.tasks.find((t) => t.operation === 'export/url').result.files[0].url;
            break;
        }
    }
    if (!url) {
        console.error('Nem fejeződött be 60 mp alatt.');
        process.exit(1);
    }

    // 4. Letöltés.
    const pdf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const kimenet = path.join(OUT_DIR, 'proba-arajanlat.pdf');
    fs.writeFileSync(kimenet, pdf);
    console.log(`Kész ${((Date.now() - t0) / 1000).toFixed(1)} mp alatt: ${kimenet} (${(pdf.length / 1024).toFixed(0)} kB)`);
}

main();
