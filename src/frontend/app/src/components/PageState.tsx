import { AlertCircle, FolderOpen, LoaderCircle } from 'lucide-react';

interface PageStateProps {
  kind: 'loading' | 'empty' | 'error';
  title?: string;
  message?: string;
  action?: React.ReactNode;
}

export default function PageState({
  kind,
  title,
  message,
  action,
}: PageStateProps) {
  const Icon =
    kind === 'loading'
      ? LoaderCircle
      : kind === 'empty'
        ? FolderOpen
        : AlertCircle;
  const resolvedTitle =
    title ??
    (kind === 'loading'
      ? 'Loading…'
      : kind === 'empty'
        ? 'Nothing here yet'
        : 'Something went wrong');

  return (
    <div className={`page-state page-state-${kind}`}>
      <Icon
        aria-hidden="true"
        className={kind === 'loading' ? 'spin' : undefined}
        size={34}
      />
      <h2>{resolvedTitle}</h2>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}
