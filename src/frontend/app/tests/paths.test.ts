import { describe, expect, it } from 'vitest';
import {
  decodeFilePath,
  directoryHref,
  encodeFilePath,
  fileHref,
  getFileKind,
} from '@/lib/paths';

describe('file path utilities', () => {
  it('encodes each path segment without encoding separators', () => {
    expect(encodeFilePath('中文 folder/report final.md')).toBe(
      '%E4%B8%AD%E6%96%87%20folder/report%20final.md',
    );
  });

  it('decodes encoded nested paths', () => {
    expect(
      decodeFilePath('%E4%B8%AD%E6%96%87%20folder/report%20final.md'),
    ).toBe('中文 folder/report final.md');
  });

  it('creates stable file and directory URLs', () => {
    expect(fileHref('notes/read me.md')).toBe('/files/notes/read%20me.md');
    expect(fileHref('video.mp4', true)).toBe('/files/video.mp4?raw=1');
    expect(directoryHref('notes/archive')).toBe('/files/notes/archive/');
    expect(directoryHref('')).toBe('/files/');
  });

  it('classifies previewable file types', () => {
    expect(getFileKind('readme.md')).toBe('markdown');
    expect(getFileKind('clip.webm')).toBe('media');
    expect(getFileKind('photo.avif')).toBe('image');
    expect(getFileKind('archive.zip')).toBe('resource');
  });
});
