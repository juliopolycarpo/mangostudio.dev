import type { APIRoute } from 'astro';

import { siteAssets } from '@/data/assets';

export const GET: APIRoute = () => {
  return new Response(
    JSON.stringify({
      name: 'MangoStudio',
      short_name: 'MangoStudio',
      description: 'Seu estúdio de IA local, em um único binário.',
      lang: 'pt',
      dir: 'ltr',
      id: '/',
      start_url: '/',
      display: 'standalone',
      background_color: '#0b0b0d',
      theme_color: '#0b0b0d',
      icons: [
        { src: siteAssets.icon192.src, sizes: '192x192', type: 'image/png' },
        { src: siteAssets.icon512.src, sizes: '512x512', type: 'image/png' },
      ],
    }),
    {
      headers: {
        'Content-Type': 'application/manifest+json',
      },
    }
  );
};
