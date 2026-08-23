import {
  Download,
  ExternalLink,
  FileDown,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Form,
  Link,
  useLoaderData,
  useRevalidator,
  useSearchParams,
} from 'react-router';
import type { FileRouteData, SearchResult } from '@/types';
import Breadcrumbs from '@/components/Breadcrumbs';
import FileIcon from '@/components/FileIcon';
import PageState from '@/components/PageState';
import {
  directoryHref,
  fileHref,
  getFileKind,
  parentDirectoryPath,
} from '@/lib/paths';

const MarkdownPage = lazy(() => import('@/routes/MarkdownPage'));
const MediaPage = lazy(() => import('@/routes/MediaPage'));

export default function FileRoute() {
  const data = useLoaderData() as FileRouteData;
  if (data.kind === 'markdown')
    return (
      <Suspense fallback={<PageState kind="loading" />}>
        <MarkdownPage data={data} />
      </Suspense>
    );
  if (data.kind === 'media')
    return (
      <Suspense fallback={<PageState kind="loading" />}>
        <MediaPage path={data.path} />
      </Suspense>
    );
  if (data.kind === 'resource') return <ResourcePage path={data.path} />;
  return <DirectoryPage data={data} />;
}

function DirectoryPage({
  data,
}: {
  data: Extract<FileRouteData, { kind: 'directory' }>;
}) {
  const revalidator = useRevalidator();
  const [, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(data.searchQuery);

  useEffect(() => setSearchValue(data.searchQuery), [data.searchQuery]);

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchValue.trim();
    if (query) setSearchParams({ q: query });
    else setSearchParams({});
  };

  const clearSearch = () => {
    setSearchValue('');
    setSearchParams({});
  };

  return (
    <div className="browser-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">File library</span>
          <h1>
            {data.path
              ? data.path.split('/').filter(Boolean).pop()
              : 'All files'}
          </h1>
          <Breadcrumbs path={data.path} />
        </div>
        <button
          className="button button-secondary"
          onClick={() => revalidator.revalidate()}
          disabled={revalidator.state === 'loading'}
        >
          <RefreshCw
            aria-hidden="true"
            className={revalidator.state === 'loading' ? 'spin' : undefined}
            size={17}
          />
          Refresh
        </button>
      </div>

      <div className="browser-toolbar">
        <Form className="search-form" onSubmit={submitSearch} role="search">
          <Search aria-hidden="true" size={18} />
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search this directory and its subfolders"
            aria-label="Search files"
          />
          {searchValue && (
            <button
              type="button"
              className="icon-button"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X size={17} />
            </button>
          )}
          <button className="button button-primary search-button" type="submit">
            Search
          </button>
        </Form>
      </div>

      {data.searchQuery ? (
        <SearchResults
          query={data.searchQuery}
          results={data.searchResults ?? []}
        />
      ) : data.entries.length ? (
        <FileList entries={data.entries} currentPath={data.path} />
      ) : (
        <PageState
          kind="empty"
          message="Upload something from the home page to get started."
          action={
            <Link className="button button-primary" to="/#upload">
              Upload a file
            </Link>
          }
        />
      )}
    </div>
  );
}

function FileList({
  entries,
  currentPath,
}: {
  entries: { name: string; isDirectory: boolean }[];
  currentPath: string;
}) {
  const parent = parentDirectoryPath(currentPath);
  return (
    <div className="file-list" role="list">
      {currentPath && (
        <Link
          className="file-row file-row-parent"
          to={directoryHref(parent)}
          role="listitem"
        >
          <span className="file-icon">
            <FileIcon name="folder" isDirectory />
          </span>
          <span className="file-name">Parent directory</span>
        </Link>
      )}
      {entries.map((entry) => (
        <FileRow key={entry.name} entry={entry} currentPath={currentPath} />
      ))}
    </div>
  );
}

function FileRow({
  entry,
  currentPath,
}: {
  entry: { name: string; isDirectory: boolean };
  currentPath: string;
}) {
  const path = currentPath ? `${currentPath}/${entry.name}` : entry.name;
  const kind = getFileKind(entry.name);
  const content = (
    <>
      <span
        className={`file-icon ${entry.isDirectory ? 'file-icon-folder' : ''}`}
      >
        <FileIcon name={entry.name} isDirectory={entry.isDirectory} />
      </span>
      <span className="file-name">{entry.name}</span>
      {!entry.isDirectory && (
        <span className="file-kind">{kind === 'resource' ? 'File' : kind}</span>
      )}
      {!entry.isDirectory && kind === 'resource' && (
        <Download aria-hidden="true" className="file-action-icon" size={17} />
      )}
    </>
  );

  if (entry.isDirectory)
    return (
      <Link className="file-row" to={directoryHref(path)} role="listitem">
        {content}
      </Link>
    );
  if (kind === 'markdown' || kind === 'media')
    return (
      <Link className="file-row" to={fileHref(path)} role="listitem">
        {content}
      </Link>
    );
  return (
    <a className="file-row" href={fileHref(path)} role="listitem">
      {content}
    </a>
  );
}

function SearchResults({
  query,
  results,
}: {
  query: string;
  results: SearchResult[];
}) {
  return (
    <section className="search-results-section">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Search results</span>
          <h2>
            {results.length} result{results.length === 1 ? '' : 's'} for “
            {query}”
          </h2>
        </div>
      </div>
      {results.length ? (
        <div className="file-list" role="list">
          {results.map((result) => {
            const kind = getFileKind(result.relative_path);
            const content = (
              <>
                <span className="file-icon">
                  <FileIcon name={result.file_name} />
                </span>
                <span className="search-result-copy">
                  <strong>{result.file_name}</strong>
                  <small>{result.relative_path}</small>
                </span>
                {kind === 'resource' ? (
                  <ExternalLink
                    aria-hidden="true"
                    className="file-action-icon"
                    size={17}
                  />
                ) : (
                  <span className="file-kind">Open</span>
                )}
              </>
            );
            return kind === 'markdown' || kind === 'media' ? (
              <Link
                className="file-row"
                to={fileHref(result.relative_path)}
                key={result.relative_path}
                role="listitem"
              >
                {content}
              </Link>
            ) : (
              <a
                className="file-row"
                href={fileHref(result.relative_path)}
                key={result.relative_path}
                role="listitem"
              >
                {content}
              </a>
            );
          })}
        </div>
      ) : (
        <PageState
          kind="empty"
          title="No matching files"
          message="Try a shorter or different search term."
        />
      )}
    </section>
  );
}

function ResourcePage({ path }: { path: string }) {
  const rawUrl = fileHref(path, true);
  return (
    <div className="resource-page">
      <FileDown aria-hidden="true" size={44} />
      <span className="eyebrow">Downloadable file</span>
      <h1>{path.split('/').pop()}</h1>
      <p>
        This file does not have an in-app preview. Open it directly or download
        the original.
      </p>
      <div className="hero-actions">
        <a className="button button-primary" href={rawUrl}>
          Open original <ExternalLink aria-hidden="true" size={17} />
        </a>
        <Link
          className="button button-secondary"
          to={directoryHref(parentDirectoryPath(path))}
        >
          Back to folder
        </Link>
      </div>
    </div>
  );
}
