import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { CEG } from '../data/ceg';
import { SZERZO } from '../data/blog';

export async function GET(_context: APIContext) {
    const cikkek = (await getCollection('blog', ({ data }) => !data.vazlat)).sort((a, b) => b.data.megjelent.getTime() - a.data.megjelent.getTime());

    const sorok = [
        `# ${CEG.nev}`,
        '',
        `> Épületgépészeti tervezés (fűtés, hűtés, szellőzés, víz, szennyvíz, esővíz) és energetikai tanúsítvány készítése. Tanúsítás: ${CEG.tanusitasiTerulet}. Székhely: ${CEG.iranyitoszam} ${CEG.varos}, ${CEG.utca}.`,
        '',
        `Kapcsolat: ${CEG.telefon}, ${CEG.email}. Szerző: ${SZERZO.nev}, ${SZERZO.beosztas.toLowerCase()}.`,
        '',
        '## Oldalak',
        '',
        `- [Kezdőlap](${CEG.url}/): szolgáltatások áttekintése`,
        `- [Energetikai tanúsítvány](${CEG.url}/energetikai-tanusitvany/): mikor kell, hogyan készül, ajánlatkérés`,
        `- [Online árajánlat](${CEG.url}/ajanlat/): azonnali árajánlat PDF-ben`,
        `- [Blog](${CEG.url}/blog/): gyakorlati cikkek`,
        '',
        '## Cikkek',
        '',
        ...cikkek.map((cikk) => `- [${cikk.data.cim}](${CEG.url}/blog/${cikk.id}/): ${cikk.data.roviden ?? cikk.data.leiras}`)
    ];

    return new Response(sorok.join('\n') + '\n', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
