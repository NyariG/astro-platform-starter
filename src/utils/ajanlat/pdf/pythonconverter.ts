const OKTETT = 'application/octet-stream';

export type PythonKonverterBeallitas = {

    baseUrl: string;

    token?: string;

    timeoutMs?: number;

    fetchFn?: typeof fetch;
};

export class PythonConverterError extends Error {}

function bajttorzs(bytes: Uint8Array): ArrayBuffer {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function docxbolPdfPython(docx: Uint8Array, beallitas: PythonKonverterBeallitas): Promise<Uint8Array> {
    const { baseUrl, token = '', timeoutMs = 10_000, fetchFn = fetch } = beallitas;
    if (!baseUrl) throw new PythonConverterError('Hiányzó PDF_CONVERTER_URL.');

    const vezerlo = new AbortController();
    const ora = setTimeout(() => vezerlo.abort(), timeoutMs);
    try {
        const valasz = await fetchFn(`${baseUrl.replace(/\/+$/, '')}/convert`, {
            method: 'POST',
            headers: {
                'Content-Type': OKTETT,
                ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: bajttorzs(docx),
            signal: vezerlo.signal
        });
        if (!valasz.ok) {
            throw new PythonConverterError(`A Python konverter hibázott (${valasz.status}).`);
        }
        const pdf = new Uint8Array(await valasz.arrayBuffer());
        if (pdf.length < 100 || pdf[0] !== 0x25 /* % */) {
            throw new PythonConverterError('A Python konverter érvénytelen PDF-et adott.');
        }
        return pdf;
    } catch (hiba) {
        if (hiba instanceof PythonConverterError) throw hiba;
        const uzenet = hiba instanceof Error && hiba.name === 'AbortError' ? `időkorlát (${timeoutMs} ms)` : hiba instanceof Error ? hiba.message : String(hiba);
        throw new PythonConverterError(`A Python konverter hívása sikertelen: ${uzenet}`);
    } finally {
        clearTimeout(ora);
    }
}
