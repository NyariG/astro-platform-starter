import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./fill', () => ({ toltsdKiSablon: vi.fn(() => new Uint8Array([1, 2, 3])) }));
vi.mock('./pythonconverter', () => ({ docxbolPdfPython: vi.fn(), PythonConverterError: class extends Error {} }));
vi.mock('./cloudconvert', () => ({ docxbolPdf: vi.fn() }));

import { keszitsArajanlatPdf } from './generate';
import { docxbolPdfPython } from './pythonconverter';
import { docxbolPdf } from './cloudconvert';
import type { QuoteRecord } from '../store';

const PY = vi.mocked(docxbolPdfPython);
const CC = vi.mocked(docxbolPdf);
const PY_PDF = new Uint8Array([0x25, 1]);
const CC_PDF = new Uint8Array([0x25, 2]);

function rekord(over: Partial<QuoteRecord> = {}): QuoteRecord {
    return { id: 'debug', ingatlanJelleg: 'lakoepulet', ...over } as QuoteRecord;
}

const MENTETT_ENV = { ...process.env };

beforeEach(() => {
    vi.clearAllMocks();
    process.env.PDF_CONVERTER_URL = 'https://svc';
    process.env.PDF_CONVERTER_TOKEN = 't';
    process.env.CLOUDCONVERT_API_KEY = 'k';
    delete process.env.PDF_CONVERTER;
});

afterEach(() => {
    process.env = { ...MENTETT_ENV };
});

describe('keszitsArajanlatPdf — konverzió-választó', () => {
    it('nem lakóépületre nincs PDF, motor sem hívódik', async () => {
        expect(await keszitsArajanlatPdf(rekord({ ingatlanJelleg: 'ipari' }))).toBeNull();
        expect(PY).not.toHaveBeenCalled();
        expect(CC).not.toHaveBeenCalled();
    });

    it('off módban nincs PDF', async () => {
        process.env.PDF_CONVERTER = 'off';
        expect(await keszitsArajanlatPdf(rekord())).toBeNull();
        expect(PY).not.toHaveBeenCalled();
        expect(CC).not.toHaveBeenCalled();
    });

    it('alapból (python-then-cloudconvert) a Python sikere esetén nincs CloudConvert', async () => {
        PY.mockResolvedValue(PY_PDF);
        const pdf = await keszitsArajanlatPdf(rekord());
        expect(pdf).toBe(PY_PDF);
        expect(PY).toHaveBeenCalledTimes(1);
        expect(CC).not.toHaveBeenCalled();
    });

    it('Python hiba esetén a CloudConvert veszi át', async () => {
        PY.mockRejectedValue(new Error('python le'));
        CC.mockResolvedValue(CC_PDF);
        const pdf = await keszitsArajanlatPdf(rekord());
        expect(pdf).toBe(CC_PDF);
        expect(PY).toHaveBeenCalledTimes(1);
        expect(CC).toHaveBeenCalledTimes(1);
    });

    it('mindkét motor bukásánál null', async () => {
        PY.mockRejectedValue(new Error('python le'));
        CC.mockRejectedValue(new Error('cc le'));
        expect(await keszitsArajanlatPdf(rekord())).toBeNull();
    });

    it('cloudconvert módban a Python kimarad', async () => {
        process.env.PDF_CONVERTER = 'cloudconvert';
        CC.mockResolvedValue(CC_PDF);
        const pdf = await keszitsArajanlatPdf(rekord());
        expect(pdf).toBe(CC_PDF);
        expect(PY).not.toHaveBeenCalled();
    });

    it('python módban 1 retry, fallback nélkül', async () => {
        process.env.PDF_CONVERTER = 'python';
        PY.mockRejectedValue(new Error('python le'));
        const pdf = await keszitsArajanlatPdf(rekord());
        expect(pdf).toBeNull();
        expect(PY).toHaveBeenCalledTimes(2);
        expect(CC).not.toHaveBeenCalled();
    });

    it('ha nincs PDF_CONVERTER_URL, a Python kimarad és a CloudConvert jön', async () => {
        delete process.env.PDF_CONVERTER_URL;
        CC.mockResolvedValue(CC_PDF);
        const pdf = await keszitsArajanlatPdf(rekord());
        expect(pdf).toBe(CC_PDF);
        expect(PY).not.toHaveBeenCalled();
        expect(CC).toHaveBeenCalledTimes(1);
    });
});
