import { CloudUpload, FolderOpen, FolderUp, Inbox } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import DirectoryPickerDialog from '@/components/DirectoryPickerDialog';
import Toast, { type ToastTone } from '@/components/Toast';
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

type UploadTarget = { kind: 'inbox' } | { kind: 'folder'; path: string };

const PREVIEW_FILE_COUNT = 5;

export default function UploadPanel() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadQueueProgress | null>(null);
  const [target, setTarget] = useState<UploadTarget>({ kind: 'inbox' });
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: ToastTone;
  } | null>(null);
  const filesInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (window.location.hash === '#upload') {
      document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  // React has no prop for directory picking; the attribute enables it.
  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
  }, []);

  const totalBytes = useMemo(() => items.reduce((sum, item) => sum + item.file.size, 0), [items]);
  const hasFolders = useMemo(() => items.some((item) => item.relativePath.includes('/')), [items]);

  const acceptItems = (incoming: UploadItem[]) => {
    const filtered = filterUploadItems(incoming);
    setItems(filtered.items);
    setSkippedCount(filtered.skippedCount);
  };

  const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    acceptItems(itemsFromFileList(event.target.files ?? [], false));
    event.target.value = '';
  };

  const openPicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    ref.current?.click();
  };

  const submitUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (items.length === 0 || isUploading) return;

    const batch = items;
    const base = target.kind === 'inbox' ? '' : target.path;
    setIsUploading(true);
    setProgress(null);
    setToast(null);
    try {
      const responses = await runUploadQueue(batch, base, setProgress);
      const label = target.kind === 'inbox' ? 'inbox' : target.path === '.' ? 'root' : target.path;
      const response = responses[0];
      setToast({
        message:
          batch.length === 1
            ? target.kind === 'folder' && response?.relativePath
              ? `Uploaded to ${response.relativePath}.`
              : response?.message || 'File uploaded successfully.'
            : `Uploaded ${batch.length} files to ${label}.`,
        tone: 'success'
      });
      setItems([]);
      setSkippedCount(0);
    } catch (error) {
      if (error instanceof UploadQueueError) {
        // Keep the failed file and everything after it so retry resumes here.
        setItems(batch.slice(error.fileIndex));
        setToast({ message: error.message, tone: 'error' });
      } else {
        setToast({
          message: error instanceof Error ? error.message : 'Upload failed.',
          tone: 'error'
        });
      }
    } finally {
      setIsUploading(false);
      setProgress(null);
    }
  };

  const previewItems = items.slice(0, PREVIEW_FILE_COUNT);
  const remainderCount = Math.max(0, items.length - previewItems.length);
  const submitLabel = items.length > 1 ? `Upload ${items.length} files` : 'Upload file';

  return (
    <>
      <form className="panel upload-panel" onSubmit={submitUpload}>
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Quick action</span>
            <h2>Upload files</h2>
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
          className={`drop-zone ${isDragging ? 'drop-zone-active' : ''} ${items.length > 0 ? 'drop-zone-selected' : ''}`}
          onClick={() => openPicker(filesInputRef)}
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
                openPicker(folderInputRef);
              }}
            >
              <FolderUp aria-hidden="true" size={15} />
              Choose a folder
            </button>
          </span>
        </div>

        {target.kind === 'inbox' && hasFolders && (
          <p className="upload-structure-note">
            Inbox keeps file names only; folder structure is not preserved there.
          </p>
        )}

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

        <button
          className="button button-primary button-full"
          type="submit"
          disabled={items.length === 0 || isUploading}
        >
          {isUploading ? 'Uploading…' : submitLabel}
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
