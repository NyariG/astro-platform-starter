import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://localhost:4321').replace(/\/+$/, '');
const TOKEN = process.argv[3] || '';

const FAJLOK = [
    { tipus: 'nyers', fajl: path.join(ROOT, 'src/contracts/arajanlat_sablon.docx') },
    { tipus: 'normalizalt', fajl: path.join(ROOT, 'src/utils/ajanlat/pdf/template.docx') }
];

async function seedel({ tipus, fajl }) {
    if (!fs.existsSync(fajl)) {
        console.error(`  HIÁNYZIK: ${fajl}`);
        return false;
    }
    const bytes = fs.readFileSync(fajl);
    const valasz = await fetch(`${BASE}/api/ajanlat-sablon-seed?tipus=${tipus}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
        },
        body: bytes
    });
    const szoveg = await valasz.text();
    console.log(`  ${tipus}: HTTP ${valasz.status} — ${szoveg}`);
    return valasz.ok;
}

async function main() {
    console.log(`Sablon-seed → ${BASE}`);
    let mind = true;
    for (const elem of FAJLOK) {
        mind = (await seedel(elem)) && mind;
    }
    console.log(mind ? 'Kész.' : 'Hibával zárult.');
    process.exit(mind ? 0 : 1);
}

main();
