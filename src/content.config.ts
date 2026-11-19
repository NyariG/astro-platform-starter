import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { KATEGORIA_KODOK } from './data/blog';

const blog = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
    schema: ({ image }) => z.object({
        cim: z.string().max(70),
        leiras: z.string().min(50).max(165),
        kategoria: z.enum(KATEGORIA_KODOK),
        megjelent: z.coerce.date(),
        frissitve: z.coerce.date().optional(),
        vazlat: z.boolean().default(false),
        roviden: z.string().optional(),
        kep: image().optional(),
        kepAlt: z.string().optional(),
        ogKep: z.string().startsWith('/').optional(),
        gyik: z.array(z.object({ kerdes: z.string(), valasz: z.string() })).optional()
    })
});

export const collections = { blog };
