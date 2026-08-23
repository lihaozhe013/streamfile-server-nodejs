import { describe, expect, it } from 'vitest';
import { extractHeadings, processRelativePaths, slugify } from '@/lib/markdown';

describe('markdown utilities', () => {
  it('creates unique heading ids', () => {
    const used = new Set<string>();
    expect(slugify('Getting Started', used)).toBe('getting-started');
    expect(slugify('Getting Started', used)).toBe('getting-started-1');
  });

  it('extracts heading order and levels', () => {
    expect(extractHeadings('# One\n\n### Three')).toEqual([
      { id: 'one', level: 1, text: 'One' },
      { id: 'three', level: 3, text: 'Three' },
    ]);
  });

  it('resolves relative images and links from the markdown directory', () => {
    const markdown = '![Photo](../assets/photo.png)\n\n[Guide](./guide.md)';
    expect(processRelativePaths(markdown, 'docs/readme.md')).toContain(
      '/files/assets/photo.png',
    );
    expect(processRelativePaths(markdown, 'docs/readme.md')).toContain(
      '/files/docs/guide.md',
    );
  });
});
