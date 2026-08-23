import 'video.js/dist/video-js.css';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import videojs from 'video.js';
import {
  fileHref,
  isAudioPath,
  parentDirectoryPath,
  getFileExtension,
} from '@/lib/paths';

interface MediaPageProps {
  path: string;
}

export default function MediaPage({ path }: MediaPageProps) {
  const videoElement = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<ReturnType<typeof videojs> | null>(null);
  const [seekFlash, setSeekFlash] = useState<string | null>(null);
  const rawUrl = fileHref(path, true);
  const audio = isAudioPath(path);

  useEffect(() => {
    if (!videoElement.current) return;
    const player = videojs(videoElement.current, {
      controls: true,
      preload: 'auto',
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      fluid: false,
      fill: !audio,
      userActions: { hotkeys: false },
      controlBar: { volumePanel: { inline: false, vertical: true } },
      sources: [
        { src: rawUrl, type: mediaType(getFileExtension(path), audio) },
      ],
    });
    playerRef.current = player;
    return () => {
      player.dispose();
      playerRef.current = null;
    };
  }, [audio, path, rawUrl]);

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement?.getAttribute('contenteditable') === 'true'
      )
        return;
      const player = playerRef.current;
      if (!player) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        player.currentTime(
          Math.max(0, (player.currentTime() ?? 0) + direction * 5),
        );
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

  return (
    <div className="media-page">
      <header className="media-header">
        <Link
          className="button button-ghost"
          to={
            parentDirectoryPath(path)
              ? `/files/${parentDirectoryPath(path)}/`
              : '/files/'
          }
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
      <div className={audio ? 'media-stage media-stage-audio' : 'media-stage'}>
        <video
          ref={videoElement}
          className="video-js vjs-big-play-centered"
          playsInline
        />
        {seekFlash && <span className="seek-flash">{seekFlash}</span>}
      </div>
    </div>
  );
}

function mediaType(extension: string, audio: boolean): string {
  if (extension === 'mp4') return 'video/mp4';
  if (extension === 'webm') return 'video/webm';
  if (extension === 'ogv' || extension === 'ogg')
    return audio ? 'audio/ogg' : 'video/ogg';
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'm4a') return 'audio/mp4';
  if (extension === 'flac') return 'audio/flac';
  if (extension === 'aac') return 'audio/aac';
  return '';
}
