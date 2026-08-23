import { Link } from 'react-router';
import PageState from '@/components/PageState';

export default function NotFoundPage() {
  return (
    <PageState
      kind="error"
      title="Page not found"
      message="The page you requested does not exist."
      action={
        <Link className="button button-primary" to="/">
          Return home
        </Link>
      }
    />
  );
}
