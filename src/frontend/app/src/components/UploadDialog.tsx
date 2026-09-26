import { CloudUpload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/lib/api';

interface UploadDialogProps {
  /** Relative destination path; '.' uploads to the visible files root. */
  destination: string;
  onClose: () => void;
  onUploaded: (relativePath: string) => void;
}

export default function UploadDialog({ destination, onClose, onUploaded }: UploadDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUploading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isUploading, onClose]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setProgress(0);
    setError(null);
    try {
      const response = await uploadFile(selectedFile, destination, setProgress);
      onUploaded(response.relativePath ?? selectedFile.name);
      onClose();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Failed to upload the file');
    } finally {
      setIsUploading(false);
    }
  };

  const destinationLabel = destination === '.' ? 'root' : destination;

  return (
    <div className="dialog-overlay" onClick={() => !isUploading && onClose()}>
      <div
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Upload a file here"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <span className="panel-kicker">Upload</span>
          <h2>Upload here</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close upload dialog"
            disabled={isUploading}
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <p className="dialog-path-line">
          Destination: <strong>/{destinationLabel}</strong>
        </p>

        <form onSubmit={submit}>
          <div
            className={`drop-zone ${selectedFile ? 'drop-zone-selected' : ''}`}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') inputRef.current?.click();
            }}
          >
            <input
              ref={inputRef}
              type="file"
              className="visually-hidden"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              disabled={isUploading}
            />
            <span className="drop-icon">
              <CloudUpload aria-hidden="true" size={28} />
            </span>
            <strong>{selectedFile ? selectedFile.name : 'Click to choose a file'}</strong>
            <span>{selectedFile ? `${selectedFile.size} bytes` : ''}</span>
          </div>

          {isUploading && (
            <div className="progress-block" aria-live="polite">
              <div className="progress-label">
                <span>Uploading…</span>
                <span>{progress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-value" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && <p className="dialog-error">{error}</p>}

          <button
            className="button button-primary button-full"
            type="submit"
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? 'Uploading…' : 'Upload file'}
          </button>
        </form>
      </div>
    </div>
  );
}
