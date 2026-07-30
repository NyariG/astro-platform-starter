import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const BASE = (process.argv[2] || 'http://localhost:4321').replace(/\/+$/, '');
const TOKEN = process.argv[3] || '';

const KEPEK = [
    { nev: 'banner', fajl: path.join(ROOT, 'public/images/nyariterv-banner.png') },
    { nev: 'ikonok', fajl: path.join(ROOT, 'public/images/nyariterv-ikonok.png') }
];

async function seedel({ nev, fajl }) {
    if (!fs.existsSync(fajl)) {
        console.error(`  HIÁNYZIK: ${fajl}`);
        return false;
    }
    const bytes = fs.readFileSync(fajl);
    const valasz = await fetch(`${BASE}/api/markakep?nev=${nev}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/octet-stream',
            ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {})
        },
        body: bytes
    });
    console.log(`  ${nev}: HTTP ${valasz.status} — ${await valasz.text()}`);
    return valasz.ok;
}

async function main() {
    console.log(`Márkakép-seed → ${BASE}`);
    let mind = true;
    for (const kep of KEPEK) {
        mind = (await seedel(kep)) && mind;
    }
    console.log(mind ? 'Kész.' : 'Hibával zárult.');
    process.exit(mind ? 0 : 1);
}

main();
