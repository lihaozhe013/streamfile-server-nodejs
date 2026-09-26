import { Link } from 'react-router';
import PageState from '@/components/PageState';
import { useFeatures } from '@/lib/features';

export default function NotFoundPage() {
  const features = useFeatures();
  return (
    <PageState
      kind="error"
      title="Page not found"
      message="The page you requested does not exist."
      action={
        <Link className="button button-primary" to={features.homePage ? '/' : '/files/'}>
          {features.homePage ? 'Return home' : 'Browse files'}
        </Link>
      }
    />
  );
}
