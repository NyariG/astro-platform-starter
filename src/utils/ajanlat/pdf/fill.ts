import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { getSablon, type QuoteRecord } from '../store';
import { buildTemplateData, type SablonAdat } from './adatszerzodes';
import { SABLON_B64 } from './template-b64';

let sablonGyorsitotar: Buffer | null = null;

async function sablonBytes(): Promise<Buffer> {
    if (sablonGyorsitotar) return sablonGyorsitotar;

    try {
        const blob = await getSablon('normalizalt');
        if (blob && blob.byteLength > 0) {
            sablonGyorsitotar = Buffer.from(blob);
            return sablonGyorsitotar;
        }
    } catch (hiba) {
        console.warn('[arajanlat-pdf] a sablon Blobs-olvasása sikertelen — beágyazott base64 fallback.', {
            uzenet: hiba instanceof Error ? hiba.message : String(hiba)
        });
    }

    sablonGyorsitotar = Buffer.from(SABLON_B64, 'base64');
    return sablonGyorsitotar;
}

export function urionSablonGyorsitotar(): void {
    sablonGyorsitotar = null;
}

export async function toltsdKiAdattal(adat: SablonAdat): Promise<Uint8Array> {
    const zip = new PizZip(await sablonBytes());
    const doc = new Docxtemplater(zip, {
        delimiters: { start: '[', end: ']' },
        paragraphLoop: true,
        linebreaks: true,
        nullGetter: () => ''
    });
    doc.render(adat);
    return doc.getZip().generate({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function toltsdKiSablon(record: QuoteRecord): Promise<Uint8Array> {
    return toltsdKiAdattal(buildTemplateData(record));
}
