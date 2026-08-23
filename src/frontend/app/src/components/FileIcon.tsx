import {
  File,
  FileImage,
  FileText,
  Folder,
  Music2,
  Play,
  SquareArrowOutUpRight,
} from 'lucide-react';
import { getFileKind } from '@/lib/paths';

interface FileIconProps {
  name: string;
  isDirectory?: boolean;
}

export default function FileIcon({ name, isDirectory = false }: FileIconProps) {
  if (isDirectory) return <Folder aria-hidden="true" size={21} />;

  const kind = getFileKind(name);
  if (kind === 'markdown') return <FileText aria-hidden="true" size={21} />;
  if (kind === 'media') {
    const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].some(
      (extension) => name.toLowerCase().endsWith(`.${extension}`),
    );
    return isAudio ? (
      <Music2 aria-hidden="true" size={21} />
    ) : (
      <Play aria-hidden="true" size={21} />
    );
  }
  if (kind === 'image') return <FileImage aria-hidden="true" size={21} />;
  if (name.toLowerCase().endsWith('.html'))
    return <SquareArrowOutUpRight aria-hidden="true" size={21} />;
  return <File aria-hidden="true" size={21} />;
}
