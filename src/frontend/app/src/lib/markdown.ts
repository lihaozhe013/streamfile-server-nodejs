import { decodeFilePath, encodeFilePath } from '@/lib/paths';

export interface MarkdownHeading {
  id: string;
  level: number;
  text: string;
}

export function cleanMarkdownText(text: string): string {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim();
}

export function slugify(text: string, usedIds = new Set<string>()): string {
  const base =
    cleanMarkdownText(text)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-') || 'heading';

  let id = base;
  let counter = 1;
  while (usedIds.has(id)) {
    id = `${base}-${counter}`;
    counter += 1;
  }
  usedIds.add(id);
  return id;
}

export function extractHeadings(markdown: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  const usedIds = new Set<string>();
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const text = cleanMarkdownText(match[2]);
    headings.push({
      id: slugify(text, usedIds),
      level: match[1].length,
      text,
    });
  }

  return headings;
}

function resolveRelativePath(baseFilePath: string, relativePath: string) {
  const baseSegments = baseFilePath.split('/').filter(Boolean);
  baseSegments.pop();

  for (const segment of relativePath.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      baseSegments.pop();
    } else {
      baseSegments.push(segment);
    }
  }

  return baseSegments.join('/');
}

export function processRelativePaths(
  content: string,
  currentFilePath: string,
): string {
  const decodedPath = decodeFilePath(currentFilePath);
  const replacePath = (candidate: string) => {
    const [pathPart, suffix = ''] = candidate.split(/([?#].*)/, 2);
    if (
      !pathPart ||
      pathPart.startsWith('/') ||
      pathPart.startsWith('#') ||
      /^[a-z][a-z\d+.-]*:/i.test(pathPart)
    ) {
      return candidate;
    }
    return `/files/${encodeFilePath(resolveRelativePath(decodedPath, pathPart))}${suffix}`;
  };

  return content
    .replace(
      /(!?\[[^\]]*\]\()([^\s)]+)(\s+[^)]*)?\)/g,
      (_match, prefix: string, pathPart: string, title = '') =>
        `${prefix}${replacePath(pathPart)}${title})`,
    )
    .replace(
      /(<(?:img|source)[^>]+(?:src|srcset)=['"])([^'"]+)(['"])/gi,
      (_match, prefix: string, pathPart: string, suffix: string) =>
        `${prefix}${replacePath(pathPart)}${suffix}`,
    );
}
