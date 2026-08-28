import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client.js';
import { careApi, type PatientEntry } from '../api/endpoints.js';
import { EmptyState, ErrorBanner, ScreenHeader, Spinner } from '../components/ui.js';
import { ChevronRight, Users } from '../components/icons.js';

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
    <main id="main" className="app-shell" style={{ padding: '0 var(--s4)' }}>
      <ScreenHeader
        eyebrow="Only what each person chose to share"
        title="People I care for"
        action={
          <Link className="btn btn-ghost btn-sm" to="/app">
            My app
          </Link>
        }
      />

      {error && <ErrorBanner message={error} />}

      {patients.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title="Nobody has added you yet"
          description="When someone invites you as their caregiver and you accept, they appear here."
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
