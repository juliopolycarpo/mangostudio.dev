import { deepStrictEqual } from 'node:assert/strict';
import type { DocsHeading } from './docs';
import { docsToc } from './docs';

function heading(depth: number, slug: string): DocsHeading {
  return { depth, slug, text: slug.toUpperCase() };
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    process.stdout.write(`[ok] ${name}\n`);
  } catch (error) {
    process.stderr.write(`[fail] ${name}\n`);
    throw error;
  }
}

run('docsToc keeps only h2 and h3 headings, in document order', () => {
  const headings = [
    heading(1, 'title'),
    heading(2, 'install'),
    heading(4, 'detail'),
    heading(3, 'linux'),
    heading(6, 'fine-print'),
  ];

  deepStrictEqual(
    docsToc(headings).map((entry) => entry.slug),
    ['install', 'linux'],
    'expected slugs: install, linux'
  );
});

run('docsToc is empty when a page has no h2 or h3, so no column is reserved', () => {
  deepStrictEqual(
    docsToc([heading(1, 'title'), heading(4, 'detail')]),
    [],
    'expected an empty table of contents for a page with only h1 and h4 headings'
  );
  deepStrictEqual(docsToc([]), [], 'expected an empty table of contents for no headings');
});
