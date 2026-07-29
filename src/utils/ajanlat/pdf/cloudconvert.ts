const API = 'https://api.cloudconvert.com/v2';

export type KonverzioBeallitas = {
    apiKey: string;

    hataridoMs?: number;

    lekerdezesMs?: number;

    fetchFn?: typeof fetch;
};

class CloudConvertError extends Error {}

const alszik = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function docxbolPdf(docx: Uint8Array, beallitas: KonverzioBeallitas): Promise<Uint8Array> {

    const { apiKey, hataridoMs = 18_000, lekerdezesMs = 1_200, fetchFn = fetch } = beallitas;
    if (!apiKey) throw new CloudConvertError('Hiányzó CLOUDCONVERT_API_KEY.');

    const fejlec = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
    const fileB64 = Buffer.from(docx).toString('base64');

    // 1. Job létrehozása: import → convert → export.
    const jobValasz = await fetchFn(`${API}/jobs`, {
        method: 'POST',
        headers: fejlec,
        body: JSON.stringify({
            tasks: {
                'import-doc': { operation: 'import/base64', file: fileB64, filename: 'arajanlat.docx' },
                'convert-pdf': { operation: 'convert', input: 'import-doc', input_format: 'docx', output_format: 'pdf', engine: 'libreoffice' },
                'export-pdf': { operation: 'export/url', input: 'convert-pdf' }
            }
        })
    });
    if (!jobValasz.ok) {
        throw new CloudConvertError(`Job létrehozása sikertelen (${jobValasz.status}): ${(await jobValasz.text().catch(() => '')).slice(0, 300)}`);
    }
    const jobId = (await jobValasz.json())?.data?.id;
    if (!jobId) throw new CloudConvertError('A CloudConvert nem adott vissza job-azonosítót.');

    // 2. Várakozás a job befejeztére, határidőn belül.
    const kezdet = Date.now();
    let exportUrl: string | null = null;
    while (Date.now() - kezdet < hataridoMs) {
        await alszik(lekerdezesMs);
        const allapotValasz = await fetchFn(`${API}/jobs/${jobId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
        if (!allapotValasz.ok) continue;
        const job = (await allapotValasz.json())?.data;
        if (job?.status === 'error') {
            const hibas = (job.tasks || []).find((t: { status?: string; message?: string }) => t.status === 'error');
            throw new CloudConvertError(`A konverzió hibára futott: ${hibas?.message ?? 'ismeretlen ok'}`);
        }
        if (job?.status === 'finished') {
            const exportTask = (job.tasks || []).find((t: { operation?: string }) => t.operation === 'export/url');
            exportUrl = exportTask?.result?.files?.[0]?.url ?? null;
            break;
        }
    }

    if (!exportUrl) throw new CloudConvertError('A konverzió nem fejeződött be a határidőn belül.');

    // 3. A kész PDF letöltése.
    const pdfValasz = await fetchFn(exportUrl);
    if (!pdfValasz.ok) throw new CloudConvertError(`A PDF letöltése sikertelen (${pdfValasz.status}).`);
    return new Uint8Array(await pdfValasz.arrayBuffer());
}
