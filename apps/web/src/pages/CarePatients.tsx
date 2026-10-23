import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { careApi, type PatientEntry } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, ScreenHeader, Spinner } from '../components/ui.js';
import { ChevronRight, Users } from '../components/icons.js';
import { useT } from '../i18n/index.js';

export default function CarePatients() {
  const { t } = useT();
  const [patients, setPatients] = useState<PatientEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { patients: list } = await careApi.patients();
        if (!cancelled) setPatients(list);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : t('patients_load_failed'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [t]);

  if (loading) return <Spinner />;

  return (
    <main id="main" className="app-shell" style={{ padding: '0 var(--s4)' }}>
      <ScreenHeader
        eyebrow={t('patients_eyebrow')}
        title={t('patients_title')}
        action={
          <Link className="btn btn-ghost btn-sm" to="/app">
            {t('my_app')}
          </Link>
        }
      />

      {error && <ErrorBanner message={error} />}

      {patients.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title={t('patients_empty_title')}
          description={t('patients_empty_body')}
        />
      ) : (
        <div className="list">
          {patients.map((patient) => (
            <Link
              key={patient.careLinkId}
              to={`/care/patients/${patient.patientId}`}
              className="list-row list-row-link"
            >
              <div className="flex-1">
                <div className="list-title truncate">{patient.name}</div>
                <div className="subtle">{patient.relation}</div>
              </div>
              <ChevronRight size={18} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
