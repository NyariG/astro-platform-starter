import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import rehypeEkezetmentesId from './src/utils/rehype-ekezetmentes-id.mjs';

export default defineConfig({
    site: 'https://nyariterv.hu',
    markdown: {
        rehypePlugins: [rehypeEkezetmentesId]
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
