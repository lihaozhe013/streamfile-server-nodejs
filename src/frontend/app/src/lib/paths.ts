const mediaExtensions = new Set([
  'mp4',
  'webm',
  'ogv',
  'mov',
  'm4v',
  'mkv',
  'avi',
  'mp3',
  'wav',
  'ogg',
  'm4a',
  'flac',
  'aac',
]);

const imageExtensions = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'bmp',
  'webp',
  'svg',
  'ico',
  'tiff',
  'tif',
  'apng',
  'avif',
  'jfif',
  'pjpeg',
  'pjp',
  'raw',
  'heic',
  'heif',
]);

export type FileKind = 'markdown' | 'media' | 'image' | 'resource';

export function decodePathSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function decodeFilePath(pathname: string): string {
  return pathname.split('/').filter(Boolean).map(decodePathSegment).join('/');
}

export function encodeFilePath(filePath: string): string {
  return filePath.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

export function getFileExtension(filePath: string): string {
  const filename = filePath.split('/').pop() ?? '';
  const extension = filename.split('.').pop() ?? '';
  return extension.toLowerCase();
}

export function getFileKind(filePath: string): FileKind {
  const extension = getFileExtension(filePath);
  if (extension === 'md') return 'markdown';
  if (mediaExtensions.has(extension)) return 'media';
  if (imageExtensions.has(extension)) return 'image';
  return 'resource';
}

export function isAudioPath(filePath: string): boolean {
  return new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac']).has(
    getFileExtension(filePath),
  );
}

export function fileHref(filePath: string, raw = false): string {
  const href = `/files/${encodeFilePath(filePath)}`;
  return raw ? `${href}?raw=1` : href;
}

export function directoryHref(directoryPath: string): string {
  const encoded = encodeFilePath(directoryPath);
  return encoded ? `/files/${encoded}/` : '/files/';
}

export function parentDirectoryPath(directoryPath: string): string {
  const segments = directoryPath.split('/').filter(Boolean);
  return segments.slice(0, -1).join('/');
}
