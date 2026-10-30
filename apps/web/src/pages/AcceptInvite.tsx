/**
 * Accepting a caregiver invitation.
 *
 * Readable while signed out, so the person can see exactly what they are being
 * asked to accept before creating an account. The server still requires the
 * accepting account's email to match the invited address, so a forwarded link
 * grants nothing.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { CarePermissions } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { careApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner, Spinner, SuccessBanner } from '../components/ui.js';
import { Check, Info, Pill } from '../components/icons.js';
import { interleave, useT } from '../i18n/index.js';

const PERMISSIONS: (keyof CarePermissions)[] = [
  'viewMedicines',
  'viewAdherence',
  'viewAppointments',
  'receiveAlerts',
  'manageAlerts',
];

interface Invitation {
  patientName: string;
  relation: string;
  permissions: CarePermissions;
  expiresAt: string;
}

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { t } = useT();
  const token = searchParams.get('token') ?? '';

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t('invite_incomplete'));
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      try {
        const { invitation: found } = await careApi.invitation(token);
        if (!cancelled) setInvitation(found);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : t('invite_load_failed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  async function respond(accept: boolean) {
    setBusy(true);
    setError('');
    try {
      const response = await careApi.respond(token, accept);
      setResult(response.message);
      if (accept) setTimeout(() => navigate('/care'), 1500);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('invite_respond_failed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading || authLoading) return <Spinner label={t('loading_invitation')} />;

  return (
    <main id="main" className="auth-shell">
      <div className="auth-head">
        <span className="brand-mark mb-4">
          <Pill size={20} />
          MedTrack
        </span>
        <h1 className="t-title">{t('invite_title')}</h1>
      </div>

      {error && <ErrorBanner message={error} />}
      {result && <SuccessBanner message={result} />}

      {invitation && !result && (
        <div className="panel panel-pad stack">
          <p className="t-base">
            {interleave(t('invite_ask'), {
              patient: <strong>{invitation.patientName}</strong>,
              relation: <strong>{invitation.relation}</strong>,
            })}
          </p>

          <div>
            <p className="micro mb-3">{t('you_could')}</p>
            <ul className="stack stack-sm" style={{ listStyle: 'none', padding: 0 }}>
              {PERMISSIONS.filter((key) => invitation.permissions[key]).map((key) => (
                <li key={key} className="row muted t-sm" style={{ gap: 'var(--s2)' }}>
                  <Check size={15} />
                  {t(`their_${key}`)}
                </li>
              ))}
            </ul>
          </div>

          <p className="subtle">{t('they_can_withdraw', { name: invitation.patientName })}</p>

          {user ? (
            <>
              <button
                type="button"
                className="action-primary"
                onClick={() => respond(true)}
                disabled={busy}
              >
                {t(busy ? 'please_wait' : 'accept_invitation')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => respond(false)}
                disabled={busy}
              >
                {t('decline')}
              </button>
            </>
          ) : (
            <>
              {/* The account must be the invited address, so say so before they
                  sign up with a different one and hit a confusing 403. */}
              <div className="alert alert-info">
                <Info size={18} />
                <span>{t('invite_sign_in_note')}</span>
              </div>
              <Link
                className="btn btn-primary btn-block btn-lg"
                to="/login"
                state={{ from: `/care/accept?token=${token}` }}
              >
                {t('sign_in')}
              </Link>
              <Link
                className="btn btn-secondary btn-block"
                to="/signup"
                state={{ from: `/care/accept?token=${token}` }}
              >
                {t('create_account')}
              </Link>
            </>
          )}
        </div>
      )}

      {!invitation && !loading && (
        <div className="panel panel-pad stack">
          <p className="muted t-sm">{t('invite_gone')}</p>
          <Link className="btn btn-secondary btn-block" to="/">
            {t('go_to_medtrack')}
          </Link>
        </div>
      )}
    </main>
  );
}
