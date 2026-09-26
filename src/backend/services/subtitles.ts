export const MAX_SUBTITLE_BYTES = 5 * 1024 * 1024;

export type SubtitleEncoding = 'auto' | 'utf-8' | 'gb18030';

const timingPattern =
  /^(\d+):([0-5]\d):([0-5]\d),(\d{3})\s+-->\s+(\d+):([0-5]\d):([0-5]\d),(\d{3})(?:\s+.*)?$/;

export function convertSrtToVtt(bytes: Uint8Array, encoding: SubtitleEncoding): string | null {
  const source = decodeSubtitle(bytes, encoding);
  if (source === null) return null;

  const blocks = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .split(/\n{2,}/);
  const cues: string[] = [];
  let previousStart = -1;

  for (const block of blocks) {
    const lines = block.split('\n');
    const timingIndex = /^\d+$/.test(lines[0]?.trim() ?? '') ? 1 : 0;
    const match = timingPattern.exec(lines[timingIndex]?.trim() ?? '');
    const text = lines
      .slice(timingIndex + 1)
      .join('\n')
      .trim();
    if (!match || !text) return null;

    const start = timestampSeconds(match, 1);
    const end = timestampSeconds(match, 5);
    if (start < previousStart || end <= start) return null;
    previousStart = start;

    cues.push(
      `${webVttTimestamp(match, 1)} --> ${webVttTimestamp(match, 5)}\n${safeCueText(text)}`
    );
  }

  return cues.length ? `WEBVTT\n\n${cues.join('\n\n')}\n` : null;
}

function decodeSubtitle(bytes: Uint8Array, encoding: SubtitleEncoding): string | null {
  const candidates = encoding === 'auto' ? (['utf-8', 'gb18030'] as const) : [encoding];
  for (const candidate of candidates) {
    try {
      return new TextDecoder(candidate, { fatal: true }).decode(bytes);
    } catch {
      continue;
    }
  }
  return null;
}

function timestampSeconds(match: RegExpExecArray, offset: number): number {
  return (
    Number(match[offset]) * 3600 +
    Number(match[offset + 1]) * 60 +
    Number(match[offset + 2]) +
    Number(match[offset + 3]) / 1000
  );
}

function webVttTimestamp(match: RegExpExecArray, offset: number): string {
  return `${match[offset].padStart(2, '0')}:${match[offset + 1]}:${match[offset + 2]}.${match[offset + 3]}`;
}

function safeCueText(text: string): string {
  return text
    .replace(/\{\\[^}]*\}/g, '')
    .replace(/<\/?font(?:\s+[^>]*)?>/gi, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;(\/?)((?:i|b|u))&gt;/gi, '<$1$2>');
}
