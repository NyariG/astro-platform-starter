import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import rehypeEkezetmentesId from './src/utils/rehype-ekezetmentes-id.mjs';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export default defineConfig({
    site: 'https://nyariterv.hu',
    markdown: {
        remarkPlugins: [remarkMath],
        rehypePlugins: [rehypeKatex, rehypeEkezetmentesId]
    },
    vite: {
        plugins: [tailwindcss()]
    },
    integrations: [react(), sitemap()],
    adapter: netlify({
        devFeatures: {
            environmentVariables: true
        }
    })
});
