
export function isMediaExtension(ext: string): boolean {
  switch (ext.toLowerCase()) {
    // Video
    case '.mp4':
    case '.webm':
    case '.ogv':
    case '.mov':
    case '.m4v':
    case '.mkv':
    case '.avi':
      return true;
    // Audio
    case '.mp3':
    case '.wav':
    case '.ogg':
    case '.m4a':
    case '.flac':
    case '.aac':
      return true;
    default:
      return false;
  }
}
