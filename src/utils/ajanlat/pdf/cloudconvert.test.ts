import { describe, expect, it, vi } from 'vitest';
import { docxbolPdf } from './cloudconvert';

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

function valasz(body: unknown, ok = true, status = 200): Response {
    return { ok, status, json: async () => body, text: async () => JSON.stringify(body), arrayBuffer: async () => PDF_BYTES.buffer } as unknown as Response;
}

describe('docxbolPdf', () => {
    it('sikeres job: létrehoz, lekérdez, letölt', async () => {
        const hivasok: string[] = [];
        const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
            const u = String(url);
            hivasok.push(`${init?.method ?? 'GET'} ${u}`);
            if (u.endsWith('/jobs') && init?.method === 'POST') return valasz({ data: { id: 'job1' } });
            if (u.includes('/jobs/job1')) {
                return valasz({ data: { status: 'finished', tasks: [{ operation: 'export/url', result: { files: [{ url: 'https://storage/pdf' }] } }] } });
            }
            if (u === 'https://storage/pdf') return valasz(null);
            throw new Error(`váratlan hívás: ${u}`);
        });

        const pdf = await docxbolPdf(new Uint8Array([1, 2, 3]), { apiKey: 'k', lekerdezesMs: 1, fetchFn: fetchFn as unknown as typeof fetch });
        expect(Array.from(pdf)).toEqual(Array.from(PDF_BYTES));
        expect(hivasok[0]).toContain('POST');
        expect(hivasok.some((h) => h.includes('https://storage/pdf'))).toBe(true);
    });

    it('a konverzió hibás státuszánál dob', async () => {
        const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
            const u = String(url);
            if (u.endsWith('/jobs') && init?.method === 'POST') return valasz({ data: { id: 'job1' } });
            return valasz({ data: { status: 'error', tasks: [{ status: 'error', message: 'nem sikerült' }] } });
        });
        await expect(docxbolPdf(new Uint8Array([1]), { apiKey: 'k', lekerdezesMs: 1, fetchFn: fetchFn as unknown as typeof fetch })).rejects.toThrow(/nem sikerült/);
    });

    it('határidő-túllépésnél dob', async () => {
        const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
            const u = String(url);
            if (u.endsWith('/jobs') && init?.method === 'POST') return valasz({ data: { id: 'job1' } });
            return valasz({ data: { status: 'processing', tasks: [] } });
        });
        await expect(docxbolPdf(new Uint8Array([1]), { apiKey: 'k', lekerdezesMs: 1, hataridoMs: 10, fetchFn: fetchFn as unknown as typeof fetch })).rejects.toThrow(/határidő/);
    });

    it('hiányzó kulcsnál azonnal dob', async () => {
        await expect(docxbolPdf(new Uint8Array([1]), { apiKey: '' })).rejects.toThrow(/CLOUDCONVERT_API_KEY/);
    });

    it('a job létrehozásának hibáját jelzi', async () => {
        const fetchFn = vi.fn(async () => valasz('szerverhiba', false, 500));
        await expect(docxbolPdf(new Uint8Array([1]), { apiKey: 'k', fetchFn: fetchFn as unknown as typeof fetch })).rejects.toThrow(/Job létrehozása sikertelen/);
    });
});
