import { ArrowRight, CloudUpload, FolderOpen, ShieldCheck } from 'lucide-react';
import { Link, Navigate } from 'react-router';
import UploadPanel from '@/components/UploadPanel';
import { useFeatures } from '@/lib/features';

export default function HomePage() {
  const features = useFeatures();
  if (!features.homePage) return <Navigate to="/files/" replace />;

  return (
    <div className="home-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">Your files, beautifully simple</span>
          <h1>A calm place for everything you share.</h1>
          <p>
            {features.upload
              ? 'Browse, preview, and upload files from any device on your local network. StreamFile keeps the experience fast without getting in your way.'
              : 'Browse and preview files from any device on your local network. StreamFile keeps the experience fast without getting in your way.'}
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" to="/files/">
              <FolderOpen aria-hidden="true" size={18} />
              Browse files
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
            {features.upload && (
              <a className="button button-secondary" href="#upload">
                <CloudUpload aria-hidden="true" size={18} />
                Upload a file
              </a>
            )}
          </div>
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="hero-card-glow" />
          <ShieldCheck size={44} />
          <strong>Local by default</strong>
          <span>No database. No account. No noise.</span>
        </div>
      </section>

      <section className={features.upload ? 'home-grid' : 'home-grid home-grid-single'} id="upload">
        {features.upload && <UploadPanel />}
        <div className="panel browse-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Your library</span>
              <h2>Open the drive</h2>
            </div>
            <FolderOpen aria-hidden="true" size={24} />
          </div>
          <p>
            Jump into your files with a responsive browser, fast search, and previews for the
            formats you use most.
          </p>
          <Link className="button button-secondary button-full" to="/files/">
            Browse files
            <ArrowRight aria-hidden="true" size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
