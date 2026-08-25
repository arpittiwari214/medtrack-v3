import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Shared chrome for the legal documents.
 *
 * These pages are public and linked from the footer, the signup form and the
 * app. A policy that can only be read from inside the product is not really
 * published, and someone deciding whether to sign up needs to read it first.
 */
export default function LegalLayout({
  title,
  effectiveDate,
  version,
  summary,
  children,
}: {
  title: string;
  effectiveDate: string;
  version: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <>
      <header className="site-header">
        <div className="container row-between" style={{ minHeight: 64 }}>
          <Link to="/" style={{ textDecoration: 'none', color: 'var(--text)' }}>
            <strong>
              <span aria-hidden="true">💊</span> MedTrack
            </strong>
          </Link>
          <Link className="btn btn-ghost btn-sm" to="/">
            Back
          </Link>
        </div>
      </header>

      <main id="main" className="doc">
        <h1>{title}</h1>
        <p className="doc-meta">
          Version {version} · In effect from {effectiveDate}
        </p>

        {/* A plain-language summary above the formal text. The detailed version
            still governs, but nobody should have to read three thousand words
            to learn what the service actually does with their data. */}
        <div className="alert alert-info" style={{ marginBottom: 'var(--s6)' }}>
          <span aria-hidden="true">ℹ</span>
          <div>
            <strong>In short:</strong> {summary}
          </div>
        </div>

        {children}

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: 'var(--s7) 0 var(--s5)' }} />

        <ul className="footer-links">
          <li>
            <Link to="/privacy">Privacy Policy</Link>
          </li>
          <li>
            <Link to="/terms">Terms of Service</Link>
          </li>
          <li>
            <Link to="/medical-disclaimer">Medical Disclaimer</Link>
          </li>
          <li>
            <Link to="/cookies">Cookies</Link>
          </li>
        </ul>
      </main>
    </>
  );
}
