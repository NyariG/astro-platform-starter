import { readEnv, type QuoteRecord } from '../store';
import { toltsdKiSablon } from './fill';
import { docxbolPdf } from './cloudconvert';
import { docxbolPdfPython } from './pythonconverter';
import { keszitsBeepitettPdf } from './beepitett-pdf';

export const PDF_FAJLNEV = 'Nyari-Terv-arajanlat.pdf';

const PDF_KERET_MS = 22_000;

const PYTHON_PROBA_MS = 10_000;

type Mod = 'python' | 'cloudconvert' | 'builtin' | 'python-then-cloudconvert' | 'auto' | 'off';

const ERVENYES_MODOK: Mod[] = ['python', 'cloudconvert', 'builtin', 'python-then-cloudconvert', 'auto', 'off'];

function mod(): Mod {
    const nyers = (readEnv('PDF_CONVERTER') || 'auto').trim() as Mod;
    return ERVENYES_MODOK.includes(nyers) ? nyers : 'auto';
}

export async function konvertaljDocxPdf(docx: Uint8Array, opts: { id?: string; record?: QuoteRecord } = {}): Promise<Uint8Array | null> {
    const id = opts.id ?? '—';
    const valasztott = mod();
    if (valasztott === 'off') return null;
    if (valasztott === 'builtin') return opts.record ? beepitett(id, opts.record) : null;

    const kezdet = Date.now();
    const hatralevo = () => PDF_KERET_MS - (Date.now() - kezdet);

    const pythonPrimary = valasztott === 'python' || valasztott === 'python-then-cloudconvert' || valasztott === 'auto';
    const cloudFallback = valasztott === 'cloudconvert' || valasztott === 'python-then-cloudconvert' || valasztott === 'auto';
    const builtinFallback = valasztott === 'auto' && Boolean(opts.record);

    const pythonRetryk = valasztott === 'python' ? 1 : 0;

    if (pythonPrimary) {
        const pdf = await pythonKonvertal(id, docx, pythonRetryk, hatralevo);
        if (pdf) return pdf;
    }

    if (cloudFallback) {
        const pdf = await cloudKonvertal(id, docx, hatralevo);
        if (pdf) return pdf;
    }

    if (builtinFallback) {
        const pdf = await beepitett(id, opts.record as QuoteRecord);
        if (pdf) return pdf;
    }

    console.error('[arajanlat-pdf] egyik motor sem adott PDF-et.', { id });
    return null;
}

export async function keszitsArajanlatPdf(record: QuoteRecord): Promise<Uint8Array | null> {
    if (record.ingatlanJelleg !== 'lakoepulet') return null;
    const valasztott = mod();
    if (valasztott === 'off') return null;
    if (valasztott === 'builtin') return beepitett(record.id, record);

    let docx: Uint8Array;
    try {
        docx = await toltsdKiSablon(record);
    } catch (hiba) {
        console.error('[arajanlat-pdf] a sablon kitöltése sikertelen.', {
            id: record.id,
            uzenet: hiba instanceof Error ? hiba.message : String(hiba)
        });
        return valasztott === 'auto' ? beepitett(record.id, record) : null;
    }

    return konvertaljDocxPdf(docx, { id: record.id, record });
}

async function beepitett(id: string, record: QuoteRecord): Promise<Uint8Array | null> {
    try {
        return await keszitsBeepitettPdf(record);
    } catch (hiba) {
        console.error('[arajanlat-pdf] beépített PDF sikertelen', {
            id,
            uzenet: hiba instanceof Error ? hiba.message : String(hiba)
        });
        return null;
    }
}

async function pythonKonvertal(id: string, docx: Uint8Array, retryk: number, hatralevo: () => number): Promise<Uint8Array | null> {
    const baseUrl = readEnv('PDF_CONVERTER_URL');
    if (!baseUrl) return null;
    const token = readEnv('PDF_CONVERTER_TOKEN') ?? '';

    for (let proba = 0; proba <= retryk; proba++) {
        const idokeret = Math.min(PYTHON_PROBA_MS, hatralevo());
        if (idokeret < 2_000) return null;
        try {
            return await docxbolPdfPython(docx, { baseUrl, token, timeoutMs: idokeret });
        } catch (hiba) {
            console.warn('[arajanlat-pdf] Python konverter sikertelen', {
                id,
                proba: proba + 1,
                uzenet: hiba instanceof Error ? hiba.message : String(hiba)
            });
        }
    }
    return null;
}

async function cloudKonvertal(id: string, docx: Uint8Array, hatralevo: () => number): Promise<Uint8Array | null> {
    const apiKey = readEnv('CLOUDCONVERT_API_KEY');
    if (!apiKey) return null;
    const idokeret = hatralevo();
    if (idokeret < 3_000) return null;
    try {
        return await docxbolPdf(docx, { apiKey, hataridoMs: idokeret });
    } catch (hiba) {
        console.error('[arajanlat-pdf] CloudConvert fallback sikertelen', {
            id,
            uzenet: hiba instanceof Error ? hiba.message : String(hiba)
        });
        return null;
    }
}
