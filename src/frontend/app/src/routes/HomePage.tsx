import { ArrowRight, CloudUpload, FolderOpen, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { uploadFile } from '@/lib/api';
import Toast, { type ToastTone } from '@/components/Toast';

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
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
    try {
      const response = await uploadFile(selectedFile, setProgress);
      setToast({
        message: response.message || 'File uploaded successfully.',
        tone: 'success',
      });
      setSelectedFile(null);
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setToast({
        message: error instanceof Error ? error.message : 'Upload failed.',
        tone: 'error',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Your files, beautifully simple</span>
          <h1>A calm place for everything you share.</h1>
          <p>
            Browse, preview, and upload files from any device on your local
            network. StreamFile keeps the experience fast without getting in
            your way.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/files/">
              <FolderOpen aria-hidden="true" size={18} />
              Browse files
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            <a className="button button-secondary" href="#upload">
              <CloudUpload aria-hidden="true" size={18} />
              Upload a file
            </a>
          </div>
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="hero-card-glow" />
          <ShieldCheck size={44} />
          <strong>Local by default</strong>
          <span>No database. No account. No noise.</span>
        </div>
      </section>

      <section className="home-grid" id="upload">
        <form className="panel upload-panel" onSubmit={submitUpload}>
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Quick action</span>
              <h2>Upload a file</h2>
            </div>
            <CloudUpload aria-hidden="true" size={24} />
          </div>

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
            <strong>
              {selectedFile ? selectedFile.name : 'Drop a file here'}
            </strong>
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
                <div
                  className="progress-value"
                  style={{ width: `${progress}%` }}
                />
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

        <div className="panel browse-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Your library</span>
              <h2>Open the drive</h2>
            </div>
            <FolderOpen aria-hidden="true" size={24} />
          </div>
          <p>
            Jump into your files with a responsive browser, fast search, and
            previews for the formats you use most.
          </p>
          <Link className="button button-secondary button-full" to="/files/">
            Browse files
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </section>

      {toast && <Toast {...toast} onDismiss={() => setToast(null)} />}
    </div>
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
