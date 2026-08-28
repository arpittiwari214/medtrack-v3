/**
 * Small shared UI pieces.
 *
 * Status is deliberately never communicated by colour alone — every badge
 * carries a word and a glyph, because red/green is precisely the distinction a
 * meaningful share of people cannot make, and this app uses it to say "taken"
 * versus "missed".
 */

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { DoseStatus } from '@medtrack/shared';
import { Calendar, Chart, Home, Pill, Settings } from './icons.js';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="row" style={{ justifyContent: 'center', padding: 'var(--s6)' }}>
      <div className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      <span aria-hidden="true">⚠</span>
      <div style={{ flex: 1 }}>
        <div>{message}</div>
        {onRetry && (
          <button type="button" className="btn btn-sm btn-secondary" style={{ marginTop: 'var(--s3)' }} onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="alert alert-ok" role="status">
      <span aria-hidden="true">✓</span>
      <div>{message}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true">
        {icon}
      </div>
      <h3 style={{ marginBottom: 'var(--s2)', fontSize: '1.125rem' }}>{title}</h3>
      <p className="muted" style={{ marginBottom: 'var(--s5)', maxWidth: '42ch', marginInline: 'auto' }}>
        {description}
      </p>
      {action}
    </div>
  );
}

const STATUS_META: Record<DoseStatus, { label: string; className: string; glyph: string }> = {
  taken: { label: 'Taken', className: 'badge-ok', glyph: '✓' },
  missed: { label: 'Missed', className: 'badge-danger', glyph: '✕' },
  snoozed: { label: 'Snoozed', className: 'badge-warn', glyph: '⏰' },
  skipped: { label: 'Skipped', className: 'badge-neutral', glyph: '–' },
  scheduled: { label: 'Due', className: 'badge-info', glyph: '•' },
};

export function StatusBadge({ status }: { status: DoseStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`badge ${meta.className}`}>
      <span aria-hidden="true">{meta.glyph}</span>
      {meta.label}
    </span>
  );
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="row-between" style={{ marginBottom: 'var(--s5)' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem' }}>{title}</h1>
        {subtitle && <p className="muted" style={{ fontSize: '0.9375rem' }}>{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

const NAV_ITEMS = [
  { to: '/app', Icon: Home, label: 'Today', end: true },
  { to: '/app/medicines', Icon: Pill, label: 'Medicines', end: false },
  { to: '/app/analytics', Icon: Chart, label: 'Insights', end: false },
  { to: '/app/appointments', Icon: Calendar, label: 'Visits', end: false },
  { to: '/app/settings', Icon: Settings, label: 'Settings', end: false },
];

export function BottomNav({ alertCount = 0 }: { alertCount?: number }) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV_ITEMS.map(({ to, Icon, label, end }) => (
        <NavLink key={to} to={to} end={end} className="nav-item">
          <span className="nav-icon">
            {/* Stroked icons inherit the active colour and sit level with the
                label, which platform-drawn emoji cannot do. */}
            <Icon size={22} />
            {to === '/app/settings' && alertCount > 0 && (
              <span className="nav-badge">{alertCount > 9 ? '9+' : alertCount}</span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * A dismissible modal.
 *
 * Closing on backdrop click and on Escape are both wired, because a modal that
 * can only be dismissed by finding the right button is a trap on a small screen.
 */
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <div className="sheet">
        <div className="row-between" style={{ marginBottom: 'var(--s4)' }}>
          <h2 style={{ fontSize: '1.25rem' }}>{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
