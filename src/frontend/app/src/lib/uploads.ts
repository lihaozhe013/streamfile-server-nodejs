import { uploadFile } from '@/lib/api';
import type { UploadResponse } from '@/types';

/** A file queued for upload together with its path inside the picked tree. */
export interface UploadItem {
  file: File;
  /**
   * Path of the file relative to the selected or dropped root, for example
   * `vacation/2023/beach.jpg`. Plain file name for flat multi-select.
   */
  relativePath: string;
}

export interface UploadQueueProgress {
  /** Files finished before the one currently uploading. */
  completedFiles: number;
  totalFiles: number;
  /** Byte-weighted progress across the whole batch, 0-100. */
  percent: number;
  currentName: string;
}

export class UploadQueueError extends Error {
  readonly fileName: string;
  readonly fileIndex: number;

  constructor(fileName: string, fileIndex: number, message: string) {
    super(`Upload failed for ${fileName}: ${message}`);
    this.name = 'UploadQueueError';
    this.fileName = fileName;
    this.fileIndex = fileIndex;
  }
}

function relativePathSegments(value: string): string[] {
  return value
    .replaceAll('\\', '/')
    .split('/')
    .filter((segment) => segment !== '' && segment !== '.');
}

/**
 * Joins the upload target with the directory part of a file's relative path.
 * The inbox target ('') stays flat; the visible root ('.') without a
 * directory stays '.'. Produces forward-slash paths like the server expects.
 */
export function uploadDestination(base: string, relativePath: string): string {
  if (!base) return '';
  const directorySegments = relativePathSegments(relativePath).slice(0, -1);
  return [...relativePathSegments(base), ...directorySegments].join('/') || '.';
}

/**
 * True when a directory segment of the relative path is dot-prefixed; the
 * server rejects such destinations, so these entries are skipped client-side.
 */
export function hasHiddenDirectorySegment(relativePath: string): boolean {
  return relativePathSegments(relativePath)
    .slice(0, -1)
    .some((segment) => segment.startsWith('.'));
}

export interface FilteredUploadItems {
  items: UploadItem[];
  skippedCount: number;
}

/** Drops files living inside dot-prefixed directories. */
export function filterUploadItems(items: UploadItem[]): FilteredUploadItems {
  const kept = items.filter((item) => !hasHiddenDirectorySegment(item.relativePath));
  return { items: kept, skippedCount: items.length - kept.length };
}

/**
 * Builds queue items from an input's file list. Folder picks carry their
 * structure in `webkitRelativePath`; plain multi-select uses the file name.
 */
export function itemsFromFileList(files: ArrayLike<File>, folderMode: boolean): UploadItem[] {
  return Array.from(files, (file) => ({
    file,
    relativePath: folderMode ? file.webkitRelativePath || file.name : file.name
  }));
}

function entryFile(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null)
    );
  });
}

/**
 * Directory readers return at most a page of entries per call; keep calling
 * until a batch comes back empty.
 */
async function readAllDirectoryEntries(
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  const entries: FileSystemEntry[] = [];
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve) => {
      reader.readEntries(
        (read) => resolve(read),
        () => resolve([])
      );
    });
    if (batch.length === 0) return entries;
    entries.push(...batch);
  }
}

async function collectEntryTree(
  entry: FileSystemEntry,
  prefix: string,
  collected: UploadItem[]
): Promise<void> {
  if (entry.isFile) {
    const file = await entryFile(entry as FileSystemFileEntry);
    if (file) collected.push({ file, relativePath: prefix });
    return;
  }
  if (!entry.isDirectory) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children = await readAllDirectoryEntries(reader);
  for (const child of children) {
    await collectEntryTree(child, prefix ? `${prefix}/${child.name}` : child.name, collected);
  }
}

/**
 * Collects every file from a drop event, recursing into dropped folders
 * through the entries API. Falls back to the flat file list when the API is
 * unavailable or the drop carries no entries (as in synthesized test events).
 */
export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<UploadItem[]> {
  const itemList = dataTransfer.items;
  const entries: FileSystemEntry[] = [];
  if (itemList) {
    for (let index = 0; index < itemList.length; index += 1) {
      const entry = itemList[index].webkitGetAsEntry?.() ?? null;
      if (entry) entries.push(entry);
    }
  }

  if (entries.length === 0) return itemsFromFileList(dataTransfer.files, false);

  const collected: UploadItem[] = [];
  for (const entry of entries) {
    await collectEntryTree(entry, entry.name, collected);
  }
  return collected.length > 0 ? collected : itemsFromFileList(dataTransfer.files, false);
}

/**
 * Uploads the batch sequentially, one `POST /upload` per file, reporting
 * byte-weighted overall progress. Stops at the first failure and throws an
 * `UploadQueueError` naming the failing file; responses match the input order.
 */
export async function runUploadQueue(
  items: UploadItem[],
  base: string,
  onProgress: (progress: UploadQueueProgress) => void
): Promise<UploadResponse[]> {
  const totalBytes = items.reduce((sum, item) => sum + item.file.size, 0);
  let sentBytes = 0;
  const responses: UploadResponse[] = [];

  for (const [index, item] of items.entries()) {
    const currentName = item.relativePath || item.file.name;
    try {
      const response = await uploadFile(
        item.file,
        uploadDestination(base, item.relativePath),
        (filePercent) => {
          const safePercent = Number.isFinite(filePercent) ? filePercent : 100;
          const loadedBytes = Math.min(
            item.file.size,
            Math.round((item.file.size * safePercent) / 100)
          );
          const percent = totalBytes > 0 ? ((sentBytes + loadedBytes) / totalBytes) * 100 : 100;
          onProgress({
            completedFiles: index,
            totalFiles: items.length,
            percent: Math.min(100, Math.max(0, Math.round(percent))),
            currentName
          });
        }
      );
      responses.push(response);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Upload failed';
      throw new UploadQueueError(currentName, index, message);
    }
    sentBytes += item.file.size;
  }

  return responses;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 0; value >= 1024 && index < units.length - 1; index += 1) {
    value /= 1024;
    unit = units[index + 1];
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${unit}`;
}
