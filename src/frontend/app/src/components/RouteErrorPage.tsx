import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import PageState from '@/components/PageState';

export default function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText || `Request failed with status ${error.status}`
    : error instanceof Error
      ? error.message
      : 'The requested page could not be loaded.';

  return (
    <PageState
      kind="error"
      title="Unable to load this page"
      message={message}
      action={
        <Link className="button button-primary" to="/">
          Return home
        </Link>
      }
    />
  );
}
