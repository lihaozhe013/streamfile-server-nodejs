import { CloudUpload, FolderOpen, Inbox } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { uploadFile } from '@/lib/api';
import DirectoryPickerDialog from '@/components/DirectoryPickerDialog';
import Toast, { type ToastTone } from '@/components/Toast';

type UploadTarget = { kind: 'inbox' } | { kind: 'folder'; path: string };

export default function UploadPanel() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState<UploadTarget>({ kind: 'inbox' });
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.location.hash === '#upload') {
      document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const chooseFile = (file: File | undefined) => {
    if (file) setSelectedFile(file);
  };

  const submitUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setProgress(0);
    setToast(null);
    const destination = target.kind === 'inbox' ? '' : target.path;
    try {
      const response = await uploadFile(selectedFile, destination, setProgress);
      setToast({
        message:
          target.kind === 'folder' && response.relativePath
            ? `Uploaded to ${response.relativePath}.`
            : response.message || 'File uploaded successfully.',
        tone: 'success'
      });
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setToast({
        message: error instanceof Error ? error.message : 'Upload failed.',
        tone: 'error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <form className="panel upload-panel" onSubmit={submitUpload}>
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Quick action</span>
            <h2>Upload a file</h2>
          </div>
          <CloudUpload aria-hidden="true" size={24} />
        </div>

        <fieldset className="upload-target-group" disabled={isUploading}>
          <legend className="visually-hidden">Upload destination</legend>
          <label
            className={`upload-target-option ${target.kind === 'inbox' ? 'upload-target-active' : ''}`}
          >
            <input
              type="radio"
              name="upload-target"
              value="inbox"
              checked={target.kind === 'inbox'}
              onChange={() => setTarget({ kind: 'inbox' })}
            />
            <Inbox aria-hidden="true" size={17} />
            <span>
              <strong>Inbox</strong>
              <small>Hidden area, not shown in file lists</small>
            </span>
          </label>
          <label
            className={`upload-target-option ${target.kind === 'folder' ? 'upload-target-active' : ''}`}
          >
            <input
              type="radio"
              name="upload-target"
              value="folder"
              checked={target.kind === 'folder'}
              onChange={() => {
                setTarget(target.kind === 'folder' ? target : { kind: 'folder', path: '.' });
                setIsPickerOpen(true);
              }}
            />
            <FolderOpen aria-hidden="true" size={17} />
            <span>
              <strong>Files folder</strong>
              <small>
                {target.kind === 'folder'
                  ? target.path === '.'
                    ? 'Visible files (root)'
                    : target.path
                  : 'Pick any visible directory'}
              </small>
            </span>
          </label>
          {target.kind === 'folder' && (
            <button
              type="button"
              className="button button-ghost button-small upload-target-change"
              onClick={() => setIsPickerOpen(true)}
            >
              Change folder…
            </button>
          )}
        </fieldset>

        <div
          className={`drop-zone ${isDragging ? 'drop-zone-active' : ''} ${selectedFile ? 'drop-zone-selected' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            chooseFile(event.dataTransfer.files[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="visually-hidden"
            onChange={(event) => chooseFile(event.target.files?.[0])}
            disabled={isUploading}
          />
          <span className="drop-icon">
            <CloudUpload aria-hidden="true" size={28} />
          </span>
          <strong>{selectedFile ? selectedFile.name : 'Drop a file here'}</strong>
          <span>
            {selectedFile
              ? formatFileSize(selectedFile.size)
              : 'or click to choose one from your device'}
          </span>
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

        <button
          className="button button-primary button-full"
          type="submit"
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? 'Uploading…' : 'Upload file'}
        </button>
      </form>
      {isPickerOpen && (
        <DirectoryPickerDialog
          initialPath={target.kind === 'folder' && target.path !== '.' ? target.path : ''}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(directoryPath) => {
            setTarget({ kind: 'folder', path: directoryPath });
            setIsPickerOpen(false);
          }}
        />
      )}

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </>
  );
}

function formatFileSize(bytes: number): string {
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
