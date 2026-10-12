import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  collectDroppedFiles,
  filterUploadItems,
  formatFileSize,
  itemsFromFileList,
  runUploadQueue,
  UploadQueueError,
  uploadDestination,
  type UploadItem,
  type UploadQueueProgress
} from '@/lib/uploads';
import { uploadFile } from '@/lib/api';
import { ApiError } from '@/types';

vi.mock('@/lib/api', () => ({ uploadFile: vi.fn() }));

function makeFile(name: string, content = 'x'): File {
  return new File([content], name);
}

function fileWithRelativePath(name: string, relativePath: string): File {
  const file = makeFile(name);
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath });
  return file;
}

function fakeFileEntry(name: string, file: File): FileSystemFileEntry {
  return {
    isFile: true,
    isDirectory: false,
    name,
    file: (callback) => callback(file)
  } as unknown as FileSystemFileEntry;
}

function fakeDirectoryReader(batches: FileSystemEntry[][]): FileSystemDirectoryReader {
  let call = 0;
  return {
    readEntries: (success) => {
      const batch = batches[call] ?? [];
      call += 1;
      success(batch);
    }
  } as unknown as FileSystemDirectoryReader;
}

function fakeDirectoryEntry(name: string, batches: FileSystemEntry[][]): FileSystemDirectoryEntry {
  return {
    isFile: false,
    isDirectory: true,
    name,
    createReader: () => fakeDirectoryReader(batches)
  } as unknown as FileSystemDirectoryEntry;
}

function fakeDataTransfer(entries: (FileSystemEntry | null)[], files: File[] = []): DataTransfer {
  const items = {
    length: entries.length,
    ...Object.fromEntries(entries.map((entry, index) => [index, { webkitGetAsEntry: () => entry }]))
  };
  return { items, files } as unknown as DataTransfer;
}

function item(file: File, relativePath: string): UploadItem {
  return { file, relativePath };
}

describe('uploadDestination', () => {
  it('keeps the inbox destination flat', () => {
    expect(uploadDestination('', 'vacation/2023/beach.jpg')).toBe('');
  });

  it('joins the file directory with the visible root', () => {
    expect(uploadDestination('.', 'vacation/2023/beach.jpg')).toBe('vacation/2023');
    expect(uploadDestination('.', 'beach.jpg')).toBe('.');
  });

  it('joins the file directory with a nested base', () => {
    expect(uploadDestination('photos', 'vacation/beach.jpg')).toBe('photos/vacation');
    expect(uploadDestination('photos', 'beach.jpg')).toBe('photos');
    expect(uploadDestination('photos/sub', 'x/y.txt')).toBe('photos/sub/x');
  });

  it('keeps Unicode names and accepts backslash input', () => {
    expect(uploadDestination('照片', '旅行/美.png')).toBe('照片/旅行');
    expect(uploadDestination('photos', 'a\\b.txt')).toBe('photos/a');
  });
});

describe('filterUploadItems', () => {
  it('drops dot-directory paths and keeps dot-named files', () => {
    const filtered = filterUploadItems([
      item(makeFile('notes.txt'), 'root/notes.txt'),
      item(makeFile('config'), 'root/.git/config'),
      item(makeFile('.env'), '.env')
    ]);
    expect(filtered.items.map((entry) => entry.relativePath)).toEqual(['root/notes.txt', '.env']);
    expect(filtered.skippedCount).toBe(1);
  });
});

describe('itemsFromFileList', () => {
  it('uses webkitRelativePath for folder picks', () => {
    const [entry] = itemsFromFileList([fileWithRelativePath('a.txt', 'root/sub/a.txt')], true);
    expect(entry.relativePath).toBe('root/sub/a.txt');
  });

  it('falls back to the file name when the relative path is empty', () => {
    const [entry] = itemsFromFileList([makeFile('b.txt')], true);
    expect(entry.relativePath).toBe('b.txt');
  });

  it('ignores relative paths for plain multi-select', () => {
    const [entry] = itemsFromFileList([fileWithRelativePath('a.txt', 'root/a.txt')], false);
    expect(entry.relativePath).toBe('a.txt');
  });
});

describe('collectDroppedFiles', () => {
  it('walks dropped directory trees with paged readers', async () => {
    const first = fakeFileEntry('a.txt', makeFile('a.txt'));
    const second = fakeFileEntry('b.txt', makeFile('b.txt'));
    const sub = fakeDirectoryEntry('sub', [[second]]);
    const root = fakeDirectoryEntry('vacation', [[first, sub], []]);

    const items = await collectDroppedFiles(fakeDataTransfer([root]));

    expect(items.map((entry) => entry.relativePath)).toEqual([
      'vacation/a.txt',
      'vacation/sub/b.txt'
    ]);
  });

  it('collects top-level dropped files by name', async () => {
    const file = makeFile('a.txt');
    const items = await collectDroppedFiles(fakeDataTransfer([fakeFileEntry('a.txt', file)]));
    expect(items).toHaveLength(1);
    expect(items[0].relativePath).toBe('a.txt');
    expect(items[0].file).toBe(file);
  });

  it('falls back to the flat file list when entries are unavailable', async () => {
    const file = makeFile('flat.txt');
    const items = await collectDroppedFiles(fakeDataTransfer([null], [file]));
    expect(items).toHaveLength(1);
    expect(items[0].relativePath).toBe('flat.txt');
    expect(items[0].file).toBe(file);
  });
});

describe('runUploadQueue', () => {
  beforeEach(() => {
    vi.mocked(uploadFile).mockReset();
    vi.mocked(uploadFile).mockResolvedValue({ message: 'ok' });
  });

  it('uploads every file with its joined destination', async () => {
    const items = [item(makeFile('a.txt'), 'root/a.txt'), item(makeFile('b.txt'), 'b.txt')];

    const responses = await runUploadQueue(items, 'photos', () => undefined);

    expect(responses).toHaveLength(2);
    expect(vi.mocked(uploadFile)).toHaveBeenNthCalledWith(
      1,
      items[0].file,
      'photos/root',
      expect.any(Function)
    );
    expect(vi.mocked(uploadFile)).toHaveBeenNthCalledWith(
      2,
      items[1].file,
      'photos',
      expect.any(Function)
    );
  });

  it('stops at the first failure and names the failing file', async () => {
    const items = [
      item(makeFile('a.txt'), 'a.txt'),
      item(makeFile('b.txt'), 'b.txt'),
      item(makeFile('c.txt'), 'c.txt')
    ];
    vi.mocked(uploadFile).mockResolvedValueOnce({ message: 'ok' });
    vi.mocked(uploadFile).mockRejectedValueOnce(new ApiError('Storage is full', 500));

    const failure = await runUploadQueue(items, '.', () => undefined).then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(UploadQueueError);
    const queueError = failure as UploadQueueError;
    expect(queueError.fileName).toBe('b.txt');
    expect(queueError.fileIndex).toBe(1);
    expect(queueError.message).toBe('Upload failed for b.txt: Storage is full');
    expect(vi.mocked(uploadFile)).toHaveBeenCalledTimes(2);
  });

  it('reports byte-weighted progress across the batch', async () => {
    const items = [
      item(makeFile('big.txt', 'x'.repeat(300)), 'big.txt'),
      item(makeFile('small.txt', 'y'.repeat(100)), 'small.txt')
    ];
    vi.mocked(uploadFile).mockImplementation((_file, _destination, onProgress) => {
      onProgress(50);
      onProgress(100);
      return Promise.resolve({ message: 'ok' });
    });

    const progress: UploadQueueProgress[] = [];
    await runUploadQueue(items, '.', (entry) => progress.push(entry));

    expect(progress[0]).toMatchObject({
      completedFiles: 0,
      totalFiles: 2,
      percent: 38,
      currentName: 'big.txt'
    });
    expect(progress[progress.length - 1]).toMatchObject({
      completedFiles: 1,
      totalFiles: 2,
      percent: 100,
      currentName: 'small.txt'
    });
  });
});

describe('formatFileSize', () => {
  it('formats byte sizes for the upload summary', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});
