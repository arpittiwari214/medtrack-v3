/**
 * Shared UI pieces.
 *
 * Status is never communicated by colour alone — every badge carries a word,
 * because red/green is precisely the distinction a meaningful share of people
 * cannot make, and this app uses it for "taken" versus "missed".
 */

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { DoseStatus } from '@medtrack/shared';
import {
  AlertTriangle,
  Calendar,
  Chart,
  Check,
  Close,
  Home,
  Info,
  Pill,
  Settings,
} from './icons.js';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="row center" style={{ justifyContent: 'center', padding: 'var(--s7)' }}>
      <div className="spinner" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error mb-3" role="alert">
      <AlertTriangle size={18} />
      <div className="flex-1">
        <div>{message}</div>
        {onRetry && (
          <button type="button" className="btn btn-sm btn-secondary mt-3" onClick={onRetry}>
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
      <Check size={18} />
      <div>{message}</div>
    </div>
  );
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <div className="alert alert-info">
      <Info size={18} />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-mark">{icon}</div>
      <h3 className="t-lg">{title}</h3>
      <p className="muted t-sm mt-2 mb-4" style={{ maxWidth: '40ch', marginInline: 'auto' }}>
        {description}
      </p>
      {action}
    </div>
  );
}

const STATUS_META: Record<DoseStatus, { label: string; className: string }> = {
  taken: { label: 'Taken', className: 'badge-ok' },
  missed: { label: 'Missed', className: 'badge-danger' },
  snoozed: { label: 'Snoozed', className: 'badge-warn' },
  skipped: { label: 'Skipped', className: 'badge-neutral' },
  scheduled: { label: 'Due', className: 'badge-info' },
};

export function StatusBadge({ status }: { status: DoseStatus }) {
  const meta = STATUS_META[status];
  return <span className={`badge ${meta.className}`}>{meta.label}</span>;
}

/** A metric strip: several readings in one bordered group, not floating cards. */
export function MetricStrip({ items }: { items: { value: string | number; label: string }[] }) {
  return (
    <div className="metric-strip">
      {items.map((item) => (
        <div key={item.label} className="metric">
          <div className="metric-value numeric">{item.value}</div>
          <div className="metric-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}

export function ScreenHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <header className="screen-head">
      <div>
        {eyebrow && <p className="micro">{eyebrow}</p>}
        <h1 className="t-title mt-2">{title}</h1>
      </div>
      {action}
    </header>
  );
}

export function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="section-head">
      <h2 className="micro">{title}</h2>
      {aside}
    </div>
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
 * A dismissible modal. Closing on backdrop click and on Escape are both wired —
 * a modal you can only leave by finding the right button is a trap on a phone.
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
        <div className="row-between mb-4">
          <h2 className="t-lg">{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <Close size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
