import { useEffect, useRef, useState } from 'react';
import type videojs from 'video.js';
import { listFiles, probeSubtitle, subtitleVttHref, type SubtitleEncoding } from '@/lib/api';
import { parentDirectoryPath } from '@/lib/paths';
import { ApiError } from '@/types';

type Player = ReturnType<typeof videojs>;
type TrackElement = ReturnType<Player['addRemoteTextTrack']>;

interface SubtitleTrack {
  element: TrackElement;
  track: TextTrack;
}

interface SubtitleError {
  message: string;
  retry: 'discover' | 'track' | 'manual' | 'none';
  name?: string;
}

interface SubtitleSession {
  player: Player;
  directory: string;
  controller: AbortController;
  tracks: Map<string, SubtitleTrack>;
  languages: Map<string, string>;
  encodings: Map<string, SubtitleEncoding>;
  verified: Set<string>;
  pending: Set<string>;
  active: boolean;
  discover: () => Promise<void>;
}

function subtitlePath(directory: string, name: string): string {
  return directory ? `${directory}/${name}` : name;
}

function sameNameSubtitle(videoPath: string): string {
  const filename = videoPath.split('/').pop() ?? '';
  return `${filename.slice(0, filename.lastIndexOf('.'))}.srt`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'Subtitle requests are limited. Please try again shortly.';
    if (error.status === 413) return 'This subtitle file is too large.';
    if (error.status === 422) return 'This subtitle file or encoding is invalid.';
    if (error.status === 403) return 'This subtitle file cannot be accessed.';
    if (error.status === 404) return 'Subtitle file not found.';
  }
  return 'Could not load subtitles. Please try again.';
}

export function useVideoSubtitles(
  path: string,
  audio: boolean,
  playerRef: React.RefObject<Player | null>
) {
  const sessionRef = useRef<SubtitleSession | null>(null);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualName, setManualName] = useState('');
  const [activeName, setActiveName] = useState<string | null>(null);
  const [activeEncoding, setActiveEncoding] = useState<SubtitleEncoding>('auto');
  const [error, setError] = useState<SubtitleError | null>(null);

  function addTrack(session: SubtitleSession, name: string, enabled = false): SubtitleTrack {
    const existing = session.tracks.get(name);
    if (existing) return existing;
    const encoding = session.encodings.get(name) ?? 'auto';
    if (!session.languages.has(name))
      session.languages.set(name, `und-x-${session.languages.size + 1}`);
    const element = session.player.addRemoteTextTrack({
      kind: 'subtitles',
      label: name,
      language: session.languages.get(name),
      src: subtitleVttHref(subtitlePath(session.directory, name), encoding),
      default: enabled
    });
    const track = (element as unknown as HTMLTrackElement).track;
    const entry = { element, track };
    session.tracks.set(name, entry);
    return entry;
  }

  function selectTrack(session: SubtitleSession, name: string): void {
    for (const [candidate, entry] of session.tracks) {
      if (candidate !== name) entry.track.mode = 'disabled';
    }
    const chosen = session.tracks.get(name);
    if (chosen) chosen.track.mode = 'showing';
    setActiveName(name);
    setActiveEncoding(session.encodings.get(name) ?? 'auto');
  }

  async function validateTrack(
    session: SubtitleSession,
    name: string,
    retry = false
  ): Promise<void> {
    const encoding = session.encodings.get(name) ?? 'auto';
    const key = `${name}\0${encoding}`;
    if (!retry && (session.verified.has(key) || session.pending.has(key))) return;
    session.pending.add(key);
    try {
      await probeSubtitle(
        subtitlePath(session.directory, name),
        encoding,
        session.controller.signal
      );
      if (!session.active) return;
      session.verified.add(key);
      if ((session.encodings.get(name) ?? 'auto') !== encoding) return;
      if (retry) {
        if (![...session.tracks.values()].some((entry) => entry.track.mode === 'showing')) {
          selectTrack(session, name);
        }
      }
      if (session.tracks.get(name)?.track.mode === 'showing') setError(null);
    } catch (cause) {
      if (!session.active || session.controller.signal.aborted) return;
      if ((session.encodings.get(name) ?? 'auto') !== encoding) return;
      const track = session.tracks.get(name)?.track;
      if (
        track?.mode === 'showing' ||
        (retry && ![...session.tracks.values()].some((entry) => entry.track.mode === 'showing'))
      ) {
        if (track) track.mode = 'disabled';
        setError({ message: errorMessage(cause), retry: 'track', name });
      }
    } finally {
      session.pending.delete(key);
    }
  }

  async function addManual(session: SubtitleSession, name: string): Promise<void> {
    if (!name || name === '.' || name === '..' || /[/\\\0]/.test(name) || !/\.srt$/i.test(name)) {
      setError({ message: 'Enter an SRT filename from this video folder.', retry: 'none' });
      return;
    }
    try {
      await probeSubtitle(subtitlePath(session.directory, name), 'auto', session.controller.signal);
      if (!session.active) return;
      session.verified.add(`${name}\0auto`);
      addTrack(session, name);
      selectTrack(session, name);
      setManualName('');
      setError(null);
    } catch (cause) {
      if (!session.active || session.controller.signal.aborted) return;
      setError({ message: errorMessage(cause), retry: 'manual', name });
    }
  }

  useEffect(() => {
    setManualEntry(false);
    setManualName('');
    setActiveName(null);
    setActiveEncoding('auto');
    setError(null);
    if (audio || !playerRef.current) return;

    const session: SubtitleSession = {
      player: playerRef.current,
      directory: parentDirectoryPath(path),
      controller: new AbortController(),
      tracks: new Map(),
      languages: new Map(),
      encodings: new Map(),
      verified: new Set(),
      pending: new Set(),
      active: true,
      discover: async () => {}
    };
    sessionRef.current = session;

    const onTrackChange = () => {
      const current = [...session.tracks].find(([, entry]) => entry.track.mode === 'showing');
      const name = current?.[0] ?? null;
      setActiveName(name);
      if (name) {
        setActiveEncoding(session.encodings.get(name) ?? 'auto');
        void validateTrack(session, name);
      }
    };
    session.player.on('texttrackchange', onTrackChange);

    session.discover = async () => {
      setError(null);
      try {
        const entries = await listFiles(session.directory, session.controller.signal);
        if (!session.active) return;
        setManualEntry(false);
        const subtitles = entries
          .filter((entry) => !entry.isDirectory && /\.srt$/i.test(entry.name))
          .map((entry) => entry.name);
        const sameName = sameNameSubtitle(path);
        const automatic = subtitles.find((name) => name.slice(0, -4) === sameName.slice(0, -4));
        for (const name of subtitles) addTrack(session, name, name === automatic);
        if (automatic) selectTrack(session, automatic);
      } catch (cause) {
        if (!session.active || session.controller.signal.aborted) return;
        if (cause instanceof ApiError && cause.status === 403) {
          setManualEntry(true);
          const automatic = sameNameSubtitle(path);
          try {
            await probeSubtitle(
              subtitlePath(session.directory, automatic),
              'auto',
              session.controller.signal
            );
            if (!session.active) return;
            session.verified.add(`${automatic}\0auto`);
            addTrack(session, automatic, true);
            if (![...session.tracks.values()].some((entry) => entry.track.mode === 'showing')) {
              selectTrack(session, automatic);
            }
          } catch (probeError) {
            if (!session.active || session.controller.signal.aborted) return;
            if (!(probeError instanceof ApiError && probeError.status === 404)) {
              setError({ message: errorMessage(probeError), retry: 'discover' });
            }
          }
        } else {
          setError({ message: errorMessage(cause), retry: 'discover' });
        }
      }
    };
    void session.discover();

    return () => {
      session.active = false;
      session.controller.abort();
      session.player.off('texttrackchange', onTrackChange);
      session.tracks.clear();
      sessionRef.current = null;
    };
  }, [audio, path, playerRef]);

  const submitManual = () => {
    const session = sessionRef.current;
    if (session) void addManual(session, manualName.trim());
  };

  const changeEncoding = (encoding: SubtitleEncoding) => {
    const session = sessionRef.current;
    const name = activeName ?? (error?.retry === 'track' ? error.name : null);
    if (!session || !name) return;
    const old = session.tracks.get(name);
    if (!old) return;
    session.encodings.set(name, encoding);
    session.player.removeRemoteTextTrack(old.element);
    session.tracks.delete(name);
    addTrack(session, name);
    selectTrack(session, name);
    setError(null);
  };

  const retry = () => {
    const session = sessionRef.current;
    if (!session || !error) return;
    if (error.retry === 'discover') void session.discover();
    else if (error.retry === 'track' && error.name) void validateTrack(session, error.name, true);
    else if (error.retry === 'manual' && error.name) void addManual(session, error.name);
  };

  return {
    manualEntry,
    manualName,
    setManualName,
    submitManual,
    activeName,
    encodingName: activeName ?? (error?.retry === 'track' ? error.name : null),
    activeEncoding,
    changeEncoding,
    error,
    retry
  };
}
