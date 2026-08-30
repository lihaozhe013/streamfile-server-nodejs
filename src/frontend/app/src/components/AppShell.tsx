import { HardDrive, Home, Menu, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import ThemeToggle from '@/components/ThemeToggle';

export default function AppShell() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <Link className="brand" to="/" onClick={closeMenu}>
            <span className="brand-mark">
              <HardDrive aria-hidden="true" size={20} />
            </span>
            <span>
              <strong>StreamFile</strong>
              <small>Personal file server</small>
            </span>
          </Link>

          <button
            className="icon-button mobile-menu-button"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? (
              <X aria-hidden="true" size={22} />
            ) : (
              <Menu aria-hidden="true" size={22} />
            )}
          </button>

          <nav className={`main-nav ${mobileMenuOpen ? 'main-nav-open' : ''}`}>
            <Link
              className={
                location.pathname === '/' ? 'nav-link active' : 'nav-link'
              }
              to="/"
              onClick={closeMenu}
            >
              <Home aria-hidden="true" size={17} />
              Home
            </Link>
            <Link
              className={
                location.pathname.startsWith('/files')
                  ? 'nav-link active'
                  : 'nav-link'
              }
              to="/files/"
              onClick={closeMenu}
            >
              <HardDrive aria-hidden="true" size={17} />
              Browse files
            </Link>
            <Link
              className="nav-link nav-upload"
              to="/#upload"
              onClick={closeMenu}
            >
              <Upload aria-hidden="true" size={17} />
              Upload
            </Link>
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <main className="page-container">
        <Outlet />
      </main>

      <footer className="app-footer">
        <span>StreamFile Server</span>
        <span>Simple, local, and private.</span>
      </footer>
    </div>
  );
}
