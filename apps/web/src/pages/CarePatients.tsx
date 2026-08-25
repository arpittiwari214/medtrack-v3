import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { careApi, type PatientEntry } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, PageHeader, Spinner } from '../components/ui.js';

export default function CarePatients() {
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
          setError(caught instanceof ApiError ? caught.message : 'Could not load your patients.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Spinner label="Loading" />;

  return (
    <main id="main" className="app-shell" style={{ padding: 'var(--s4)' }}>
      <PageHeader
        title="People I care for"
        subtitle="Only what each person has chosen to share"
        action={
          <Link className="btn btn-ghost btn-sm" to="/app">
            My app
          </Link>
        }
      />

      {error && <ErrorBanner message={error} />}

      {patients.length === 0 ? (
        <EmptyState
          icon="👥"
          title="Nobody has added you yet"
          description="When someone invites you as their caregiver and you accept, they will appear here."
        />
      ) : (
        <div className="stack">
          {patients.map((patient) => (
            <Link
              key={patient.careLinkId}
              to={`/care/patients/${patient.patientId}`}
              className="card card-tight row-between"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <h2 style={{ fontSize: '1.0625rem' }}>{patient.name}</h2>
                <p className="subtle">{patient.relation}</p>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
