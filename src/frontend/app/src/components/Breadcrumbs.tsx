import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router';
import { directoryHref } from '@/lib/paths';

interface BreadcrumbsProps {
  path: string;
}

export default function Breadcrumbs({ path }: BreadcrumbsProps) {
  const segments = path.split('/').filter(Boolean);

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/files/" aria-label="Root directory">
        <Home aria-hidden="true" size={15} />
        <span>Files</span>
      </Link>
      {segments.map((segment, index) => {
        const segmentPath = segments.slice(0, index + 1).join('/');
        const isLast = index === segments.length - 1;
        return (
          <span className="breadcrumb-segment" key={segmentPath}>
            <ChevronRight aria-hidden="true" size={14} />
            {isLast ? (
              <span aria-current="page">{segment}</span>
            ) : (
              <Link to={directoryHref(segmentPath)}>{segment}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
