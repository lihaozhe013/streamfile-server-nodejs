import { ArrowLeft, List, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import type { FileRouteData } from '@/types';
import { parentDirectoryPath } from '@/lib/paths';
import { extractHeadings, processRelativePaths, slugify } from '@/lib/markdown';
import MarkdownContent from '@/routes/MarkdownContent';

interface MarkdownPageProps {
  data: Extract<FileRouteData, { kind: 'markdown' }>;
}

export default function MarkdownPage({ data }: MarkdownPageProps) {
  const [tocOpen, setTocOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState('');
  const headings = useMemo(
    () => extractHeadings(data.markdown.content),
    [data.markdown.content],
  );
  const content = useMemo(
    () => processRelativePaths(data.markdown.content, data.path),
    [data.markdown.content, data.path],
  );

  useEffect(() => {
    if (!headings.length) return;
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter(Boolean);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveHeading(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    );
    elements.forEach((element) => element && observer.observe(element));
    return () => observer.disconnect();
  }, [headings]);

  return (
    <div className="markdown-page">
      <header className="markdown-header">
        <Link
          className="button button-secondary"
          to={
            parentDirectoryPath(data.path)
              ? `/files/${parentDirectoryPath(data.path)}/`
              : '/files/'
          }
        >
          <ArrowLeft aria-hidden="true" size={17} />
          Back to files
        </Link>
        <div className="markdown-title">
          <span className="eyebrow">Markdown document</span>
          <h1>{data.markdown.filename}</h1>
        </div>
        <button
          className="button button-secondary toc-toggle"
          onClick={() => setTocOpen(true)}
        >
          <List aria-hidden="true" size={17} />
          Contents
        </button>
      </header>

      <div className="markdown-layout">
        <aside className="toc-sidebar">
          <TableOfContents
            headings={headings}
            activeHeading={activeHeading}
            onSelect={() => undefined}
          />
        </aside>
        <article className="markdown-content">
          <MarkdownContent content={content} />
        </article>
      </div>

      {tocOpen && (
        <div
          className="toc-overlay"
          role="presentation"
          onClick={() => setTocOpen(false)}
        >
          <aside
            className="toc-drawer"
            role="dialog"
            aria-label="Table of contents"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-heading">
              <strong>Contents</strong>
              <button
                className="icon-button"
                onClick={() => setTocOpen(false)}
                aria-label="Close contents"
              >
                <X size={18} />
              </button>
            </div>
            <TableOfContents
              headings={headings}
              activeHeading={activeHeading}
              onSelect={() => setTocOpen(false)}
            />
          </aside>
        </div>
      )}
    </div>
  );
}

function TableOfContents({
  headings,
  activeHeading,
  onSelect,
}: {
  headings: ReturnType<typeof extractHeadings>;
  activeHeading: string;
  onSelect: () => void;
}) {
  if (!headings.length) return <p className="toc-empty">No headings found.</p>;
  return (
    <nav className="toc-nav">
      {headings.map((heading) => (
        <a
          className={
            activeHeading === heading.id ? 'toc-link active' : 'toc-link'
          }
          style={{ paddingLeft: `${12 + (heading.level - 1) * 14}px` }}
          href={`#${heading.id}`}
          key={heading.id}
          onClick={onSelect}
        >
          {heading.text}
        </a>
      ))}
    </nav>
  );
}

export { slugify };
