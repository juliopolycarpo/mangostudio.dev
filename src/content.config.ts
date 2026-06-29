import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const docs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/docs',
    generateId: ({ entry }) => entry.replace(/\.md$/i, ''),
  }),
  schema: z.object({
    title: z.string(),
    sidebarLabel: z.string(),
    lang: z.enum(['pt', 'en']),
    slug: z.string(),
    groupId: z.string(),
    groupTitle: z.string(),
    order: z.number(),
    sourcePath: z.string(),
    sourceUrl: z.string(),
    sourceCommit: z.string(),
  }),
});

export const collections = { docs };
