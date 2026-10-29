/**
 * Account settings, including the data-rights controls.
 *
 * Export and deletion get real estate here rather than being buried, because a
 * Privacy Policy that promises them is only honest if they are findable.
 */

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CONSENT_SCOPE, type ConsentKind } from '@medtrack/shared';
import { ApiError, tokens } from '../api/client.js';
import { accountApi, authApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner, Modal, PasswordInput, ScreenHeader, SuccessBanner } from '../components/ui.js';
import { AlertTriangle, ChevronRight, Users } from '../components/icons.js';
import { interleave, useT, type StringKey } from '../i18n/index.js';

const LANGUAGES: { value: string | null; label: string }[] = [
  { value: null, label: '' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
];

export default function Settings() {
  const { user, signOut, refresh } = useAuth();
  const { t, locale, preference, setPreference } = useT();

  const [name, setName] = useState(user?.name ?? '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const OPTIONAL: ConsentKind[] = ['research_use', 'marketing_email'];
  const isGranted = (kind: ConsentKind) =>
    Boolean(user?.consents?.some((consent) => consent.kind === kind && !consent.withdrawnAt));

  /** Withdrawing must be as easy as agreeing: one click either way. */
  async function toggleConsent(kind: ConsentKind, granted: boolean) {
    setError('');
    setStatus('');
    try {
      await accountApi.updateConsent({ kind, granted, language: locale });
      await refresh();
      setStatus(t(granted ? 'turned_on' : 'turned_off'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('choice_failed'));
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await authApi.updateProfile({ name });
      await refresh();
      setStatus(t('saved'));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('save_failed'));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Fetched with the auth header and turned into a blob rather than linked
   * directly — a plain `<a href>` cannot carry a bearer token.
   */
  async function downloadExport() {
    setError('');
    try {
      const response = await fetch(accountApi.exportUrl(), {
        headers: { Authorization: `Bearer ${tokens.access() ?? ''}` },
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `medtrack-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t('export_failed'));
    }
  }

  return (
    <div>
      <ScreenHeader eyebrow={user?.email} title={t('settings_title')} />

      {error && <ErrorBanner message={error} />}
      {status && <SuccessBanner message={status} />}

      <div className="stack">
        <form className="panel" onSubmit={saveProfile}>
          <div className="panel-head">
            <span className="micro">{t('your_details')}</span>
          </div>
          <div className="panel-body stack">
            <div className="field">
              <label className="label" htmlFor="name">
                {t('name')}
              </label>
              <input
                id="name"
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="field">
              <span className="label">{t('timezone')}</span>
              <p className="muted t-sm">{user?.timezone}</p>
              <span className="field-hint">{t('timezone_hint')}</span>
            </div>

            <button className="btn btn-primary" type="submit" disabled={busy}>
              {t(busy ? 'saving' : 'save_changes')}
            </button>
          </div>
        </form>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">{t('language')}</span>
          </div>
          <div className="panel-body row row-wrap" style={{ gap: 'var(--s2)' }}>
            {LANGUAGES.map((option) => (
              <button
                key={option.value ?? 'auto'}
                type="button"
                className="slot-toggle"
                aria-pressed={preference === option.value}
                onClick={() => setPreference(option.value)}
              >
                {option.value === null ? t('language_auto') : option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">{t('sharing')}</span>
          </div>
          <div className="list" style={{ border: 'none', borderRadius: 0 }}>
            <Link className="list-row list-row-link" to="/app/caregivers">
              <Users size={18} />
              <span className="flex-1">{t('manage_caregivers')}</span>
              <ChevronRight size={16} />
            </Link>
            <Link className="list-row list-row-link" to="/care">
              <Users size={18} />
              <span className="flex-1">{t('patients_title')}</span>
              <ChevronRight size={16} />
            </Link>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">{t('security')}</span>
          </div>
          <div className="list" style={{ border: 'none', borderRadius: 0 }}>
            <button
              type="button"
              className="list-row list-row-link"
              onClick={() => setPasswordOpen(true)}
            >
              <span className="flex-1">{t('change_password')}</span>
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="list-row list-row-link"
              onClick={async () => {
                await authApi.logoutAll();
                await signOut();
              }}
            >
              <span className="flex-1">{t('sign_out_all')}</span>
              <ChevronRight size={16} />
            </button>
            <button type="button" className="list-row list-row-link" onClick={signOut}>
              <span className="flex-1">{t('sign_out')}</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">{t('privacy_choices')}</span>
          </div>
          <div className="panel-body stack">
            {OPTIONAL.map((kind) => (
              <label key={kind} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={isGranted(kind)}
                  onChange={(event) => void toggleConsent(kind, event.target.checked)}
                />
                <span className="t-sm">
                  {/* English shows the recorded wording itself; Hindi a translation of it. */}
                  {locale === 'hi' ? t(`consent_${kind}` as StringKey) : CONSENT_SCOPE[kind].purpose}
                  <span className="field-hint" style={{ display: 'block' }}>
                    {t('uses_optional', {
                      items:
                        locale === 'hi'
                          ? t(`consent_${kind}_items` as StringKey)
                          : CONSENT_SCOPE[kind].dataItems.join(', '),
                    })}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">{t('your_data')}</span>
          </div>
          <div className="panel-body">
            <p className="muted t-sm mb-3">{t('your_data_body')}</p>
            <div className="stack stack-sm">
              <button type="button" className="btn btn-secondary btn-block" onClick={downloadExport}>
                {t('download_data')}
              </button>
              <button
                type="button"
                className="btn btn-danger btn-block"
                onClick={() => setDeleteOpen(true)}
              >
                {t('delete_account')}
              </button>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span className="micro">{t('legal')}</span>
            {locale === 'hi' && <span className="t-xs muted">{t('legal_english_only')}</span>}
          </div>
          <div className="list" style={{ border: 'none', borderRadius: 0 }}>
            {(
              [
                { to: '/privacy', label: 'privacy_policy' },
                { to: '/terms', label: 'terms_of_service' },
                { to: '/medical-disclaimer', label: 'medical_disclaimer' },
                { to: '/cookies', label: 'cookies' },
              ] as const
            ).map((item) => (
              <Link key={item.to} className="list-row list-row-link" to={item.to}>
                <span className="flex-1">{t(item.label)}</span>
                <ChevronRight size={16} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      {passwordOpen && <ChangePasswordModal onClose={() => setPasswordOpen(false)} />}
      {deleteOpen && <DeleteAccountModal onClose={() => setDeleteOpen(false)} onDeleted={refresh} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await authApi.changePassword({ currentPassword, newPassword });
      tokens.set(result.accessToken, result.refreshToken);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('password_change_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('change_password')} onClose={onClose}>
      {done ? (
        <div className="stack">
          <SuccessBanner message={t('password_updated')} />
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            {t('done')}
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          {error && <ErrorBanner message={error} />}
          <div className="field">
            <label className="label" htmlFor="current">
              {t('current_password')}
            </label>
            <PasswordInput
              id="current"
              className="input"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="new">
              {t('new_password')}
            </label>
            <PasswordInput
              id="new"
              className="input"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <span className="field-hint">{t('password_min')}</span>
          </div>
          <button className="action-primary" type="submit" disabled={busy}>
            {t(busy ? 'saving' : 'change_password')}
          </button>
        </form>
      )}
    </Modal>
  );
}

function DeleteAccountModal({
  onClose,
  onDeleted,
}: {
  onClose: () => void;
  onDeleted: () => Promise<void>;
}) {
  const { t } = useT();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await accountApi.requestDeletion({ password, confirmation });
      setResult(response.message);
      await onDeleted();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('request_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('delete_title')} onClose={onClose}>
      {result ? (
        <div className="stack">
          <SuccessBanner message={result} />
          <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit}>
          {error && <ErrorBanner message={error} />}

          <div className="alert alert-warn">
            <AlertTriangle size={18} />
            <div>
              <strong>{t('erases_everything')}</strong>
              <p className="t-xs mt-2">{t('erases_body')}</p>
            </div>
          </div>

          <p className="muted t-sm">{t('download_first')}</p>

          <div className="field">
            <label className="label" htmlFor="delete-password">
              {t('your_password')}
            </label>
            <PasswordInput
              id="delete-password"
              className="input"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="confirmation">
              {interleave(t('type_to_confirm'), { phrase: <code>DELETE MY ACCOUNT</code> })}
            </label>
            <input
              id="confirmation"
              className="input"
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>

          <button className="btn btn-danger btn-block btn-lg" type="submit" disabled={busy}>
            {t(busy ? 'processing' : 'delete_account')}
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>
            {t('keep_account')}
          </button>
        </form>
      )}
    </Modal>
  );
}
