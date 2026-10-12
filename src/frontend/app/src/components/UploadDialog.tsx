import { CloudUpload, FolderUp, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collectDroppedFiles,
  filterUploadItems,
  formatFileSize,
  itemsFromFileList,
  runUploadQueue,
  UploadQueueError,
  type UploadItem,
  type UploadQueueProgress
} from '@/lib/uploads';

interface UploadDialogProps {
  /** Relative destination path; '.' uploads to the visible files root. */
  destination: string;
  onClose: () => void;
  onUploaded: (result: { count: number; relativePath?: string }) => void;
}

const PREVIEW_FILE_COUNT = 5;

export default function UploadDialog({ destination, onClose, onUploaded }: UploadDialogProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadQueueProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // React has no prop for directory picking; the attribute enables it.
  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUploading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isUploading, onClose]);

  const totalBytes = useMemo(() => items.reduce((sum, item) => sum + item.file.size, 0), [items]);

  const acceptItems = (incoming: UploadItem[]) => {
    const filtered = filterUploadItems(incoming);
    setItems(filtered.items);
    setSkippedCount(filtered.skippedCount);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptItems(itemsFromFileList(event.target.files ?? [], false));
    event.target.value = '';
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0 || isUploading) return;
    const batch = items;
    setIsUploading(true);
    setProgress(null);
    setError(null);
    try {
      const responses = await runUploadQueue(batch, destination, setProgress);
      const last = responses[responses.length - 1];
      onUploaded({
        count: batch.length,
        relativePath: last?.relativePath ?? batch[batch.length - 1].file.name
      });
      onClose();
    } catch (cause: unknown) {
      if (cause instanceof UploadQueueError) {
        // Keep the failed file and everything after it so retry resumes here.
        setItems(batch.slice(cause.fileIndex));
        setError(cause.message);
      } else {
        setError(cause instanceof Error ? cause.message : 'Failed to upload the files');
      }
    } finally {
      setIsUploading(false);
      setProgress(null);
    }
  };

  const previewItems = items.slice(0, PREVIEW_FILE_COUNT);
  const remainderCount = Math.max(0, items.length - previewItems.length);
  const destinationLabel = destination === '.' ? 'root' : destination;
  const submitLabel = items.length > 1 ? `Upload ${items.length} files` : 'Upload file';

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
            className={`drop-zone ${items.length > 0 ? 'drop-zone-selected' : ''}`}
            onClick={() => filesInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Enter') filesInputRef.current?.click();
            }}
            onDragEnter={(event) => event.preventDefault()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void collectDroppedFiles(event.dataTransfer).then(acceptItems);
            }}
          >
            <input
              ref={filesInputRef}
              type="file"
              className="visually-hidden upload-files-input"
              multiple
              onChange={onInputChange}
              disabled={isUploading}
            />
            <input
              ref={folderInputRef}
              type="file"
              className="visually-hidden upload-folder-input"
              multiple
              onChange={onInputChange}
              disabled={isUploading}
            />
            <span className="drop-icon">
              <CloudUpload aria-hidden="true" size={28} />
            </span>
            {items.length === 0 ? (
              <>
                <strong>Drop files or folders here</strong>
                <span>or click to choose files from your device</span>
              </>
            ) : (
              <>
                <strong>
                  {items.length === 1
                    ? items[0].relativePath || items[0].file.name
                    : `${items.length} files selected`}
                </strong>
                <span>
                  {formatFileSize(totalBytes)}
                  {skippedCount > 0 ? ` · ${skippedCount} hidden skipped` : ''}
                </span>
                {items.length > 1 && (
                  <ul className="upload-file-list">
                    {previewItems.map((item, index) => (
                      <li key={`${item.relativePath}-${index}`}>
                        {item.relativePath || item.file.name}
                      </li>
                    ))}
                    {remainderCount > 0 && <li>… and {remainderCount} more</li>}
                  </ul>
                )}
              </>
            )}
            <span className="upload-choice-row">
              <button
                type="button"
                className="button button-ghost button-small"
                disabled={isUploading}
                onClick={(event) => {
                  event.stopPropagation();
                  folderInputRef.current?.click();
                }}
              >
                <FolderUp aria-hidden="true" size={15} />
                Choose a folder
              </button>
            </span>
          </div>

          {isUploading && progress && (
            <div className="progress-block" aria-live="polite">
              <div className="progress-label">
                <span>
                  {progress.totalFiles > 1
                    ? `Uploading ${Math.min(progress.completedFiles + 1, progress.totalFiles)}/${progress.totalFiles}`
                    : 'Uploading…'}
                </span>
                <span>{progress.percent}%</span>
              </div>
              {progress.totalFiles > 1 && (
                <div className="progress-file" aria-hidden="true">
                  {progress.currentName}
                </div>
              )}
              <div className="progress-track">
                <div className="progress-value" style={{ width: `${progress.percent}%` }} />
              </div>
            </div>
          )}

          {error && <p className="dialog-error">{error}</p>}

          <button
            className="button button-primary button-full"
            type="submit"
            disabled={items.length === 0 || isUploading}
          >
            {isUploading ? 'Uploading…' : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
