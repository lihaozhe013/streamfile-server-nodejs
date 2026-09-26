import 'video.js/dist/video-js.css';
import './MediaPage.css';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import videojs from 'video.js';
import { fileHref, isAudioPath, parentDirectoryPath, getFileExtension } from '@/lib/paths';
import { useVideoSubtitles } from '@/routes/useVideoSubtitles';

interface MediaPageProps {
  path: string;
}

export default function MediaPage({ path }: MediaPageProps) {
  const playerContainer = useRef<HTMLDivElement>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);
  const [seekFlash, setSeekFlash] = useState<string | null>(null);
  const rawUrl = fileHref(path, true);
  const audio = isAudioPath(path);

  useEffect(() => {
    if (!playerContainer.current) return;
    const videoElement = document.createElement('video');
    videoElement.className = 'video-js vjs-big-play-centered';
    videoElement.playsInline = true;
    playerContainer.current.appendChild(videoElement);
    const player = videojs(videoElement, {
      controls: true,
      preload: 'auto',
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      fluid: false,
      fill: !audio,
      userActions: { hotkeys: false },
      html5: { nativeTextTracks: false, preloadTextTracks: false },
      controlBar: { volumePanel: { inline: false, vertical: true } },
      sources: [{ src: rawUrl, type: mediaType(getFileExtension(path), audio) }]
    });
    playerRef.current = player;
    return () => {
      player.dispose();
      videoElement.remove();
      playerRef.current = null;
    };
  }, [audio, path, rawUrl]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true'
      )
        return;
      const player = playerRef.current;
      if (!player) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        player.currentTime(Math.max(0, (player.currentTime() ?? 0) + direction * 5));
        setSeekFlash(`${direction > 0 ? '+' : ''}${direction * 5}s`);
        window.setTimeout(() => setSeekFlash(null), 400);
      } else if (event.key === ' ') {
        event.preventDefault();
        if (player.paused()) void player.play();
        else player.pause();
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault();
        if (player.isFullscreen()) void player.exitFullscreen();
        else void player.requestFullscreen();
      }
    };
    document.addEventListener('keydown', handleKeyboard);
    return () => document.removeEventListener('keydown', handleKeyboard);
  }, []);

  const subtitles = useVideoSubtitles(path, audio, playerRef);

  return (
    <div className="media-page">
      <header className="media-header">
        <Link
          className="button button-ghost"
          to={parentDirectoryPath(path) ? `/files/${parentDirectoryPath(path)}/` : '/files/'}
        >
          <ArrowLeft aria-hidden="true" size={18} />
          Back
        </Link>
        <div className="media-title">
          <span>{path.split('/').pop()}</span>
          <small>← → seek 5s · Space pause · F fullscreen</small>
        </div>
        <a className="button button-ghost" href={rawUrl}>
          <ExternalLink aria-hidden="true" size={17} /> Native player
        </a>
      </header>
      {!audio && (subtitles.manualEntry || subtitles.encodingName || subtitles.error) && (
        <div className="subtitle-toolbar">
          {subtitles.manualEntry && (
            <form
              className="subtitle-manual-form"
              onSubmit={(event) => {
                event.preventDefault();
                subtitles.submitManual();
              }}
            >
              <label htmlFor="subtitle-filename">Subtitle filename</label>
              <input
                id="subtitle-filename"
                type="text"
                value={subtitles.manualName}
                onChange={(event) => subtitles.setManualName(event.target.value)}
                placeholder="other-language.srt"
              />
              <button className="button button-secondary" type="submit">
                Add subtitle
              </button>
            </form>
          )}
          {subtitles.encodingName && (
            <label className="subtitle-encoding">
              <span>Encoding for {subtitles.encodingName}</span>
              <select
                value={subtitles.activeEncoding}
                onChange={(event) =>
                  subtitles.changeEncoding(event.target.value as typeof subtitles.activeEncoding)
                }
              >
                <option value="auto">Auto</option>
                <option value="utf-8">UTF-8</option>
                <option value="gb18030">GB18030</option>
              </select>
            </label>
          )}
          {subtitles.error && (
            <div className="subtitle-error" role="alert">
              <span>{subtitles.error.message}</span>
              {subtitles.error.retry !== 'none' && (
                <button className="button button-secondary" type="button" onClick={subtitles.retry}>
                  Retry
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <div className={audio ? 'media-stage media-stage-audio' : 'media-stage'}>
        <div ref={playerContainer} className="media-player-container" />
        {seekFlash && <span className="seek-flash">{seekFlash}</span>}
      </div>
    </div>
  );
}

function mediaType(extension: string, audio: boolean): string {
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  if (extension === 'ogv' || extension === 'ogg') return audio ? 'audio/ogg' : 'video/ogg';
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'm4a') return 'audio/mp4';
  if (extension === 'flac') return 'audio/flac';
  if (extension === 'aac') return 'audio/aac';
  return '';
}
