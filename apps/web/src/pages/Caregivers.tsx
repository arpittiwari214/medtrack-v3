/**
 * Managing who can see your data.
 *
 * The screen is written so that granting access is a deliberate act with
 * visible consequences, and withdrawing it is a single tap that needs nobody
 * else's agreement. Under the DPDP Act consent must be as easy to withdraw as
 * it was to give, and that is a reasonable design rule regardless of the law.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CarePermissions } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { careApi, type CaregiverEntry } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, Modal, PageHeader, Spinner } from '../components/ui.js';

const PERMISSION_LABELS: { key: keyof CarePermissions; label: string; description: string }[] = [
  { key: 'viewMedicines', label: 'See my medicines', description: 'Names, strengths and schedules.' },
  { key: 'viewAdherence', label: 'See whether I took them', description: 'Daily history and trends.' },
  { key: 'viewAppointments', label: 'See my appointments', description: 'Doctor visits and lab tests.' },
  { key: 'receiveAlerts', label: 'Get alerts', description: 'Missed critical doses and SOS.' },
  { key: 'manageAlerts', label: 'Resolve alerts', description: 'Mark an alert as handled.' },
];

const DEFAULT_PERMISSIONS: CarePermissions = {
  viewMedicines: true,
  viewAdherence: true,
  viewAppointments: false,
  receiveAlerts: true,
  manageAlerts: false,
};

export default function Caregivers() {
  const [caregivers, setCaregivers] = useState<CaregiverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const { caregivers: list } = await careApi.caregivers();
      setCaregivers(list);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load your caregivers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(caregiver: CaregiverEntry) {
    const confirmed = window.confirm(
      `Withdraw ${caregiver.email}'s access?\n\nThey will immediately stop seeing your information and stop receiving alerts.`,
    );
    if (!confirmed) return;

    try {
      await careApi.revoke(caregiver.id);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not withdraw access.');
    }
  }

  if (loading) return <Spinner label="Loading caregivers" />;

  return (
    <div className="stack">
      <PageHeader
        title="Caregivers"
        subtitle="People who can see what you choose to share"
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
            + Invite
          </button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {caregivers.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No caregivers yet"
          description="Invite someone you trust. You choose exactly what they see, and you can withdraw it at any time without asking them."
          action={
            <button type="button" className="btn btn-primary" onClick={() => setInviteOpen(true)}>
              Invite a caregiver
            </button>
          }
        />
      ) : (
        caregivers.map((caregiver) => (
          <article key={caregiver.id} className="card card-tight stack" style={{ gap: 'var(--s3)' }}>
            <div className="row-between">
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: '1rem' }}>{caregiver.relation}</h2>
                <p className="subtle" style={{ wordBreak: 'break-all' }}>
                  {caregiver.email}
                </p>
              </div>
              <span className={`badge ${caregiver.status === 'active' ? 'badge-ok' : 'badge-warn'}`}>
                {caregiver.status === 'active' ? 'Active' : 'Invitation sent'}
              </span>
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.875rem' }}>
              {PERMISSION_LABELS.filter((permission) => caregiver.permissions[permission.key]).map(
                (permission) => (
                  <li key={permission.key} className="muted">
                    <span aria-hidden="true">✓</span> {permission.label}
                  </li>
                ),
              )}
            </ul>

            <button type="button" className="btn btn-ghost btn-sm" onClick={() => revoke(caregiver)}>
              Withdraw access
            </button>
          </article>
        ))
      )}

      {inviteOpen && (
        <InviteModal
          onClose={() => setInviteOpen(false)}
          onDone={async () => {
            setInviteOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}

function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [relation, setRelation] = useState('');
  const [permissions, setPermissions] = useState<CarePermissions>(DEFAULT_PERMISSIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function toggle(key: keyof CarePermissions) {
    setPermissions((previous) => ({ ...previous, [key]: !previous[key] }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await careApi.invite({ email, relation, permissions });
      onDone();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send that invitation.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Invite a caregiver" onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {error && <ErrorBanner message={error} />}

        <p className="muted" style={{ fontSize: '0.9375rem' }}>
          They will get an email inviting them to accept. Nothing is shared until they do.
        </p>

        <div className="field">
          <label className="label" htmlFor="email">
            Their email address
          </label>
          <input
            id="email"
            className="input"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="relation">
            Who are they to you?
          </label>
          <input
            id="relation"
            className="input"
            required
            placeholder="e.g. Daughter, Spouse, Dr. Rao"
            value={relation}
            onChange={(event) => setRelation(event.target.value)}
          />
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="label" style={{ marginBottom: 'var(--s2)' }}>
            What can they see?
          </legend>
          {PERMISSION_LABELS.map((permission) => (
            <label key={permission.key} className="checkbox-row">
              <input
                type="checkbox"
                checked={permissions[permission.key]}
                onChange={() => toggle(permission.key)}
              />
              <span>
                <strong style={{ fontSize: '0.9375rem' }}>{permission.label}</strong>
                <span className="field-hint" style={{ display: 'block' }}>
                  {permission.description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Sending…' : 'Send invitation'}
        </button>
      </form>
    </Modal>
  );
}
