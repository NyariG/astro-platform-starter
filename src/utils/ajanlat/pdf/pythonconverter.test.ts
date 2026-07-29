import { describe, expect, it, vi } from 'vitest';
import { docxbolPdfPython, PythonConverterError } from './pythonconverter';

const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, ...new Array(200).fill(0)]);

function valasz(body: Uint8Array | null, ok = true, status = 200): Response {
    return { ok, status, arrayBuffer: async () => (body ?? new Uint8Array()).buffer } as unknown as Response;
}

describe('docxbolPdfPython', () => {
    it('sikeres válasznál a PDF bájtjait adja', async () => {
        const fetchFn = vi.fn(async () => valasz(PDF));
        const pdf = await docxbolPdfPython(new Uint8Array([1, 2, 3]), { baseUrl: 'https://svc', token: 't', fetchFn: fetchFn as unknown as typeof fetch });
        expect(pdf[0]).toBe(0x25);
    });

    it('a /convert végpontot hívja, Bearer-fejléccel', async () => {
        let url = '';
        let init: RequestInit | undefined;
        const fetchFn = vi.fn(async (u: string | URL | Request, i?: RequestInit) => {
            url = String(u);
            init = i;
            return valasz(PDF);
        });
        await docxbolPdfPython(new Uint8Array([1]), { baseUrl: 'https://svc/', token: 'titok', fetchFn: fetchFn as unknown as typeof fetch });
        expect(url).toBe('https://svc/convert');
        expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer titok');
    });

    it('token nélkül nincs Authorization fejléc', async () => {
        let init: RequestInit | undefined;
        const fetchFn = vi.fn(async (_u: unknown, i?: RequestInit) => {
            init = i;
            return valasz(PDF);
        });
        await docxbolPdfPython(new Uint8Array([1]), { baseUrl: 'https://svc', fetchFn: fetchFn as unknown as typeof fetch });
        expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
    });

    it('hiányzó baseUrl esetén dob', async () => {
        await expect(docxbolPdfPython(new Uint8Array([1]), { baseUrl: '' })).rejects.toThrow(PythonConverterError);
    });

    it('nem-ok válasznál dob', async () => {
        const fetchFn = vi.fn(async () => valasz(null, false, 500));
        await expect(docxbolPdfPython(new Uint8Array([1]), { baseUrl: 'https://svc', fetchFn: fetchFn as unknown as typeof fetch })).rejects.toThrow(/500/);
    });

    it('érvénytelen PDF kimenetnél dob', async () => {
        const fetchFn = vi.fn(async () => valasz(new Uint8Array([1, 2, 3])));
        await expect(docxbolPdfPython(new Uint8Array([1]), { baseUrl: 'https://svc', fetchFn: fetchFn as unknown as typeof fetch })).rejects.toThrow(/érvénytelen PDF/);
    });

    it('megszakításnál (timeout) beszédes hibát ad', async () => {
        const fetchFn = vi.fn(async () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            throw e;
        });
        await expect(docxbolPdfPython(new Uint8Array([1]), { baseUrl: 'https://svc', timeoutMs: 5, fetchFn: fetchFn as unknown as typeof fetch })).rejects.toThrow(/időkorlát/);
    });
});
