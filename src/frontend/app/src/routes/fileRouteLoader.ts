import type { LoaderFunctionArgs } from 'react-router';
import { getMarkdown, listFiles, searchFiles } from '@/lib/api';
import { decodeFilePath, getFileKind } from '@/lib/paths';
import type { FileRouteData } from '@/types';

export async function fileRouteLoader({
  params,
  request,
}: LoaderFunctionArgs): Promise<FileRouteData> {
  const path = decodeFilePath(params['*'] ?? '');
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('q')?.trim() ?? '';
  const kind = getFileKind(path);

  if (kind === 'markdown') {
    return {
      kind: 'markdown',
      path,
      markdown: await getMarkdown(path, request.signal),
    };
  }
  if (kind === 'media') return { kind: 'media', path };

  try {
    const entries = await listFiles(path, request.signal);
    const searchResults = searchQuery
      ? (await searchFiles(searchQuery, path, request.signal)).results
      : null;
    return { kind: 'directory', path, entries, searchQuery, searchResults };
  } catch {
    return { kind: 'resource', path };
  }
}
