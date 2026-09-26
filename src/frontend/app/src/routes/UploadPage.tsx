import UploadPanel from '@/components/UploadPanel';
import { useFeatures } from '@/lib/features';
import NotFoundPage from '@/routes/NotFoundPage';

export default function UploadPage() {
  const features = useFeatures();
  if (!features.upload) return <NotFoundPage />;

  return (
    <div className="upload-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">Quick action</span>
          <h1>Upload a file</h1>
        </div>
      </div>
      <UploadPanel />
    </div>
  );
}
