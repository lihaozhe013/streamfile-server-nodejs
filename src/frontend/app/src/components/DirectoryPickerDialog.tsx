import { ChevronRight, Folder, FolderInput, FolderPlus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createDirectory, listFiles } from '@/lib/api';
import { parentDirectoryPath } from '@/lib/paths';

interface DirectoryPickerDialogProps {
  /** Relative path of the folder shown when the dialog opens ('' = root). */
  initialPath: string;
  onClose: () => void;
  /** Receives the picked relative path; '.' means the visible files root. */
  onSelect: (directoryPath: string) => void;
}

function joinPath(base: string, name: string): string {
  return base ? `${base}/${name}` : name;
}

export default function DirectoryPickerDialog({
  initialPath,
  onClose,
  onSelect
}: DirectoryPickerDialogProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [directories, setDirectories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    listFiles(currentPath)
      .then((entries) => {
        if (cancelled) return;
        setDirectories(
          entries
            .filter((entry) => entry.isDirectory)
            .map((entry) => entry.name)
            .sort((left, right) => left.localeCompare(right))
        );
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setDirectories([]);
        setError(cause instanceof Error ? cause.message : 'Failed to load folders');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const createFolder = async () => {
    const name = newFolderName.trim().replace(/^\.+/, '');
    if (!name || isCreating) return;
    setIsCreating(true);
    setError(null);
    try {
      await createDirectory(joinPath(currentPath, name));
      setNewFolderName('');
      setCurrentPath(joinPath(currentPath, name));
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  };

  const confirmSelection = () => onSelect(currentPath || '.');

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        className="dialog-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Choose upload folder"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-heading">
          <span className="panel-kicker">Upload folder</span>
          <h2>Choose a destination</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close folder picker">
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="dialog-toolbar">
          <button
            className="button button-secondary button-small"
            onClick={() => setCurrentPath(parentDirectoryPath(currentPath))}
            disabled={!currentPath}
          >
            <Folder aria-hidden="true" size={16} />
            Parent
          </button>
          <span className="dialog-path" title={currentPath || '(root)'}>
            /{currentPath || 'root'}
          </span>
        </div>

        <div className="dialog-list">
          {isLoading && <p className="dialog-hint">Loading folders…</p>}
          {!isLoading && error && <p className="dialog-error">{error}</p>}
          {!isLoading && !error && directories.length === 0 && (
            <p className="dialog-hint">No folders here yet.</p>
          )}
          {!isLoading &&
            directories.map((name) => (
              <button
                key={name}
                type="button"
                className="dialog-row"
                onClick={() => setCurrentPath(joinPath(currentPath, name))}
              >
                <Folder aria-hidden="true" size={18} />
                <span>{name}</span>
                <ChevronRight aria-hidden="true" size={16} />
              </button>
            ))}
        </div>

        <div className="dialog-new-folder">
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void createFolder();
              }
            }}
            placeholder="New folder name"
            aria-label="New folder name"
          />
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => void createFolder()}
            disabled={!newFolderName.trim() || isCreating}
          >
            <FolderPlus aria-hidden="true" size={16} />
            {isCreating ? 'Creating…' : 'Create'}
          </button>
        </div>

        <div className="dialog-footer">
          <button className="button button-primary" onClick={confirmSelection}>
            <FolderInput aria-hidden="true" size={17} />
            Upload to “{currentPath ? currentPath.split('/').pop() : 'root'}”
          </button>
          <button className="button button-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
