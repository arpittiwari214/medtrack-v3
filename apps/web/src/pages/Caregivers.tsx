/**
 * Managing who can see your data.
 *
 * Written so that granting access is a deliberate act with visible
 * consequences, and withdrawing it is a single tap needing nobody else's
 * agreement. The DPDP Act requires consent to be as easy to withdraw as to
 * give; it is a reasonable design rule regardless of the law.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CarePermissions } from '@medtrack/shared';
import { ApiError } from '../api/client.js';
import { careApi, type CaregiverEntry } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, Modal, ScreenHeader, Spinner } from '../components/ui.js';
import { Check, Plus, Users } from '../components/icons.js';
import { useT } from '../i18n/index.js';

const PERMISSIONS: (keyof CarePermissions)[] = [
  'viewMedicines',
  'viewAdherence',
  'viewAppointments',
  'receiveAlerts',
  'manageAlerts',
];

const DEFAULT_PERMISSIONS: CarePermissions = {
  viewMedicines: true,
  viewAdherence: true,
  viewAppointments: false,
  receiveAlerts: true,
  manageAlerts: false,
};

export default function Caregivers() {
  const { t } = useT();
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
      setError(caught instanceof ApiError ? caught.message : t('caregivers_load_failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(caregiver: CaregiverEntry) {
    const confirmed = window.confirm(t('revoke_confirm', { email: caregiver.email }));
    if (!confirmed) return;

    try {
      await careApi.revoke(caregiver.id);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t('revoke_failed'));
    }
  }

  if (loading) return <Spinner label={t('loading_caregivers')} />;

  return (
    <div>
      <ScreenHeader
        eyebrow={t('caregivers_eyebrow')}
        title={t('caregivers_title')}
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setInviteOpen(true)}>
            <Plus size={16} />
            {t('invite')}
          </button>
        }
      />

      {error && <ErrorBanner message={error} onRetry={load} />}

      {caregivers.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title={t('caregivers_empty_title')}
          description={t('caregivers_empty_body')}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setInviteOpen(true)}>
              {t('invite_caregiver')}
            </button>
          }
        />
      ) : (
        <div className="stack">
          {caregivers.map((caregiver) => (
            <article key={caregiver.id} className="panel">
              <div className="panel-head">
                <span className="micro">{caregiver.relation}</span>
                <span className={`badge ${caregiver.status === 'active' ? 'badge-ok' : 'badge-warn'}`}>
                  {t(caregiver.status === 'active' ? 'link_active' : 'link_invited')}
                </span>
              </div>

              <div className="panel-body">
                <p className="t-sm truncate" style={{ fontWeight: 600 }}>
                  {caregiver.email}
                </p>

                <ul className="stack stack-sm mt-3" style={{ listStyle: 'none', padding: 0 }}>
                  {PERMISSIONS.filter((key) => caregiver.permissions[key]).map((key) => (
                    <li key={key} className="row muted t-sm" style={{ gap: 'var(--s2)' }}>
                      <Check size={15} />
                      {t(`perm_${key}`)}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm mt-4"
                  onClick={() => revoke(caregiver)}
                >
                  {t('withdraw_access')}
                </button>
              </div>
            </article>
          ))}
        </div>
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
  const { t } = useT();
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
      setError(caught instanceof ApiError ? caught.message : t('invite_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={t('invite_caregiver')} onClose={onClose}>
      <form className="stack" onSubmit={submit}>
        {error && <ErrorBanner message={error} />}

        <p className="muted t-sm">{t('invite_note')}</p>

        <div className="field">
          <label className="label" htmlFor="email">
            {t('their_email')}
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
            {t('who_to_you')}
          </label>
          <input
            id="relation"
            className="input"
            required
            placeholder={t('relation_example')}
            value={relation}
            onChange={(event) => setRelation(event.target.value)}
          />
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend className="label mb-3">{t('what_can_see')}</legend>
          {PERMISSIONS.map((key) => (
            <label key={key} className="checkbox-row">
              <input type="checkbox" checked={permissions[key]} onChange={() => toggle(key)} />
              <span>
                <strong className="t-sm">{t(`perm_${key}`)}</strong>
                <span className="field-hint" style={{ display: 'block' }}>
                  {t(`perm_${key}_d`)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <button className="action-primary" type="submit" disabled={busy}>
          {t(busy ? 'sending' : 'send_invitation')}
        </button>
      </form>
    </Modal>
  );
}
