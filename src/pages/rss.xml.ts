import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { CEG } from '../data/ceg';

export async function GET(context: APIContext) {
    const cikkek = (await getCollection('blog', ({ data }) => !data.vazlat)).sort((a, b) => b.data.megjelent.getTime() - a.data.megjelent.getTime());

    return rss({
        title: `${CEG.nev} blog`,
        description: 'Gyakorlati cikkek épületgépészetről és energetikai tanúsításról.',
        site: context.site ?? CEG.url,
        customData: '<language>hu-hu</language>',
        items: cikkek.map((cikk) => ({
            title: cikk.data.cim,
            description: cikk.data.leiras,
            pubDate: cikk.data.megjelent,
            link: `/blog/${cikk.id}/`
        }))
    });
}
