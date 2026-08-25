/**
 * Accepting a caregiver invitation.
 *
 * The invitation is readable while signed out so the person can see exactly
 * what they are being asked to accept before creating an account. The server
 * still requires the accepting account's email to match the invited address, so
 * a forwarded link grants nothing.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { CarePermissions } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { careApi } from '../api/endpoints.js';
import { useAuth } from '../context/AuthContext.js';
import { ErrorBanner, Spinner, SuccessBanner } from '../components/ui.js';

const PERMISSION_LABELS: Record<keyof CarePermissions, string> = {
  viewMedicines: 'See their medicines',
  viewAdherence: 'See whether they took them',
  viewAppointments: 'See their appointments',
  receiveAlerts: 'Receive alerts about missed doses and emergencies',
  manageAlerts: 'Mark alerts as handled',
};

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
  const token = searchParams.get('token') ?? '';

  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('That invitation link is incomplete.');
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
          setError(
            caught instanceof ApiError ? caught.message : 'Could not load that invitation.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function respond(accept: boolean) {
    setBusy(true);
    setError('');
    try {
      const response = await careApi.respond(token, accept);
      setResult(response.message);
      if (accept) setTimeout(() => navigate('/care'), 1500);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not respond to that invitation.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || authLoading) return <Spinner label="Loading invitation" />;

  return (
    <main id="main" className="container" style={{ maxWidth: 480, paddingBlock: 'var(--s7)' }}>
      <div className="stack" style={{ textAlign: 'center', marginBottom: 'var(--s5)' }}>
        <span style={{ fontSize: '2rem' }} aria-hidden="true">
          💊
        </span>
        <h1 style={{ fontSize: '1.5rem' }}>A caregiver invitation</h1>
      </div>

      {error && <ErrorBanner message={error} />}
      {result && <SuccessBanner message={result} />}

      {invitation && !result && (
        <div className="card stack">
          <p style={{ fontSize: '1.0625rem' }}>
            <strong>{invitation.patientName}</strong> would like you to support them on MedTrack as
            their <strong>{invitation.relation}</strong>.
          </p>

          <div>
            <h2 className="eyebrow" style={{ marginBottom: 'var(--s2)' }}>
              You would be able to
            </h2>
            <ul style={{ paddingLeft: 'var(--s5)' }}>
              {(Object.keys(PERMISSION_LABELS) as (keyof CarePermissions)[])
                .filter((key) => invitation.permissions[key])
                .map((key) => (
                  <li key={key} className="muted">
                    {PERMISSION_LABELS[key]}
                  </li>
                ))}
            </ul>
          </div>

          <p className="subtle">
            {invitation.patientName} can change or withdraw this at any time, without asking you.
          </p>

          {user ? (
            <>
              <button
                type="button"
                className="btn btn-primary btn-block btn-lg"
                onClick={() => respond(true)}
                disabled={busy}
              >
                {busy ? 'Please wait…' : 'Accept invitation'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={() => respond(false)}
                disabled={busy}
              >
                Decline
              </button>
            </>
          ) : (
            <>
              {/* The account must be the invited address, so say so before they
                  sign up with a different one and hit a confusing 403. */}
              <div className="alert alert-info">
                <span aria-hidden="true">ℹ</span>
                <span>
                  Sign in — or create an account with the address this invitation was sent to — to
                  accept it.
                </span>
              </div>
              <Link
                className="btn btn-primary btn-block btn-lg"
                to="/login"
                state={{ from: `/care/accept?token=${token}` }}
              >
                Sign in
              </Link>
              <Link className="btn btn-secondary btn-block" to="/signup">
                Create an account
              </Link>
            </>
          )}
        </div>
      )}

      {!invitation && !loading && (
        <div className="card stack">
          <p className="muted">
            This invitation may have expired, already been used, or been withdrawn.
          </p>
          <Link className="btn btn-secondary btn-block" to="/">
            Go to MedTrack
          </Link>
        </div>
      )}
    </main>
  );
}
