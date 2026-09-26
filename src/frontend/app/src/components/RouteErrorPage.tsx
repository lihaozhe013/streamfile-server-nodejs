import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import PageState from '@/components/PageState';
import { ApiError } from '@/types';

export default function RouteErrorPage() {
  const error = useRouteError();
  const rateLimited =
    (error instanceof ApiError && error.status === 429) ||
    (isRouteErrorResponse(error) && error.status === 429);
  const message = isRouteErrorResponse(error)
    ? error.statusText || `Request failed with status ${error.status}`
    : error instanceof Error
      ? error.message
      : 'The requested page could not be loaded.';

  return (
    <PageState
      kind="error"
      title={rateLimited ? 'Please try again shortly' : 'Unable to load this page'}
      message={rateLimited ? 'Too many requests. Wait about a minute, then retry.' : message}
      action={
        rateLimited ? (
          <button className="button button-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        ) : (
          <Link className="button button-primary" to="/files/">
            Browse files
          </Link>
        )
      }
    />
  );
}
