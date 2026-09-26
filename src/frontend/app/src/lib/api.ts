import type {
  FileEntry,
  MarkdownResponse,
  MkdirResponse,
  RuntimeFeatures,
  SearchResponse,
  UploadResponse
} from '@/types';
import { ApiError } from '@/types';

export type SubtitleEncoding = 'auto' | 'utf-8' | 'gb18030';

export function subtitleVttHref(filePath: string, encoding: SubtitleEncoding = 'auto'): string {
  return `/api/subtitle-vtt?${new URLSearchParams({ path: filePath, encoding })}`;
}

export async function probeSubtitle(
  filePath: string,
  encoding: SubtitleEncoding = 'auto',
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch(subtitleVttHref(filePath, encoding), { method: 'HEAD', signal });
  if (!response.ok)
    throw new ApiError(`Subtitle request failed (${response.status})`, response.status);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let payload: unknown = null;

  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? String(payload.error)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export async function getFeatures(signal?: AbortSignal): Promise<RuntimeFeatures> {
  const response = await fetch('/api/features', { signal });
  return parseResponse<RuntimeFeatures>(response);
}

export async function listFiles(filePath: string, signal?: AbortSignal): Promise<FileEntry[]> {
  const response = await fetch(`/api/list-files?path=${encodeURIComponent(filePath)}`, { signal });
  const payload = await parseResponse<FileEntry[] | { files: FileEntry[] }>(response);
  return Array.isArray(payload) ? payload : payload.files;
}

export async function searchFiles(
  query: string,
  directoryPath: string,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, dir: directoryPath });
  const response = await fetch(`/api/search?${params.toString()}`, { signal });
  return parseResponse<SearchResponse>(response);
}

export async function getMarkdown(
  filePath: string,
  signal?: AbortSignal
): Promise<MarkdownResponse> {
  const response = await fetch(`/api/markdown-content?path=${encodeURIComponent(filePath)}`, {
    signal
  });
  return parseResponse<MarkdownResponse>(response);
}

export async function createDirectory(
  directoryPath: string,
  signal?: AbortSignal
): Promise<MkdirResponse> {
  const response = await fetch('/api/mkdir', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: directoryPath }),
    signal
  });
  return parseResponse<MkdirResponse>(response);
}

export function uploadFile(
  file: File,
  destination: string,
  onProgress: (percentage: number) => void,
  signal?: AbortSignal
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('destination', destination);
    formData.append('file', file);

    const abort = () => xhr.abort();
    signal?.addEventListener('abort', abort, { once: true });

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      signal?.removeEventListener('abort', abort);
      let payload: unknown = null;
      try {
        payload = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        payload = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve((payload as UploadResponse) ?? { message: 'Upload complete' });
      } else {
        const message =
          typeof payload === 'object' && payload !== null && 'error' in payload
            ? String(payload.error)
            : `Upload failed with status ${xhr.status}`;
        reject(new ApiError(message, xhr.status));
      }
    });

    xhr.addEventListener('error', () => {
      signal?.removeEventListener('abort', abort);
      reject(new ApiError('Network error while uploading the file', 0));
    });

    xhr.addEventListener('abort', () => {
      signal?.removeEventListener('abort', abort);
      reject(new DOMException('Upload aborted', 'AbortError'));
    });

    xhr.open('POST', '/upload');
    xhr.send(formData);
  });
}
