/**
 * Shared UI pieces.
 *
 * Status is never communicated by colour alone — every badge carries a word,
 * because red/green is precisely the distinction a meaningful share of people
 * cannot make, and this app uses it for "taken" versus "missed".
 */

import { useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import type { DoseStatus } from '@medtrack/shared';
import { useT, type StringKey } from '../i18n/index.js';
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

export function Spinner({ label }: { label?: string }) {
  const { t } = useT();
  return (
    <div className="row center" style={{ justifyContent: 'center', padding: 'var(--s7)' }}>
      <div className="spinner" />
      <span className="sr-only">{label ?? t('loading')}</span>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div className="alert alert-error mb-3" role="alert">
      <AlertTriangle size={18} />
      <div className="flex-1">
        <div>{message}</div>
        {onRetry && (
          <button type="button" className="btn btn-sm btn-secondary mt-3" onClick={onRetry}>
            {t('try_again')}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * A password box with a Show/Hide switch. Typing a password blind on a phone
 * keyboard is where most failed sign-ins and mistyped new passwords come from.
 */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="password-toggle"
        aria-label={t(visible ? 'hide_password' : 'show_password')}
        aria-pressed={visible}
        aria-controls={props.id}
        onClick={() => setVisible(!visible)}
      >
        {t(visible ? 'hide' : 'show')}
      </button>
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

const STATUS_CLASS: Record<DoseStatus, string> = {
  taken: 'badge-ok',
  missed: 'badge-danger',
  snoozed: 'badge-warn',
  skipped: 'badge-neutral',
  scheduled: 'badge-info',
};

export function StatusBadge({ status }: { status: DoseStatus }) {
  const { t } = useT();
  return <span className={`badge ${STATUS_CLASS[status]}`}>{t(`state_${status}`)}</span>;
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

const NAV_ITEMS: { to: string; Icon: typeof Home; label: StringKey; end: boolean }[] = [
  { to: '/app', Icon: Home, label: 'tab_today', end: true },
  { to: '/app/medicines', Icon: Pill, label: 'tab_medicines', end: false },
  { to: '/app/analytics', Icon: Chart, label: 'tab_insights', end: false },
  { to: '/app/appointments', Icon: Calendar, label: 'tab_visits', end: false },
  { to: '/app/settings', Icon: Settings, label: 'tab_settings', end: false },
];

export function BottomNav({ alertCount = 0 }: { alertCount?: number }) {
  const { t } = useT();
  return (
    <nav className="bottom-nav" aria-label={t('nav_main')}>
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
          {t(label)}
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
  const { t } = useT();
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
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label={t('close')}>
            <Close size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
