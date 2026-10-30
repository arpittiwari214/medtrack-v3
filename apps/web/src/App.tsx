/**
 * Routing.
 *
 * Three zones with different access rules:
 *
 *  - **Public** — marketing and legal. Legal pages are deliberately reachable
 *    without an account: someone deciding whether to sign up needs to read the
 *    privacy policy first, and a policy behind a login is not really published.
 *  - **Patient** (`/app/*`) — requires a session.
 *  - **Caregiver** (`/care/*`) — requires a session, and each view additionally
 *    checks an active care link server-side.
 */

import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.js';
import { useT } from './i18n/index.js';
import { Spinner } from './components/ui.js';

import Landing from './pages/Landing.js';
import Login from './pages/Login.js';
import Signup from './pages/Signup.js';
import ForgotPassword from './pages/ForgotPassword.js';
import ResetPassword from './pages/ResetPassword.js';
import AppLayout from './pages/AppLayout.js';
import Today from './pages/Today.js';
import Medicines from './pages/Medicines.js';
import MedicineForm from './pages/MedicineForm.js';
import Analytics from './pages/Analytics.js';
import Appointments from './pages/Appointments.js';
import Settings from './pages/Settings.js';
import Caregivers from './pages/Caregivers.js';
import AcceptInvite from './pages/AcceptInvite.js';
import CarePatients from './pages/CarePatients.js';
import CarePatientDetail from './pages/CarePatientDetail.js';

// Legal documents are long and rarely visited, so they load on demand rather
// than sitting in the main bundle.
const Privacy = lazy(() => import('./pages/legal/Privacy.js'));
const Terms = lazy(() => import('./pages/legal/Terms.js'));
const MedicalDisclaimer = lazy(() => import('./pages/legal/MedicalDisclaimer.js'));
const Cookies = lazy(() => import('./pages/legal/Cookies.js'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useT();
  const location = useLocation();

  if (loading) return <Spinner label={t('checking_session')} />;
  if (!user) {
    // Remember where they were headed so sign-in can return them there.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function RedirectIfSignedIn({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useT();
  const location = useLocation();
  if (loading) return <Spinner label={t('checking_session')} />;
  // The moment sign-in or sign-up succeeds this fires, so it must honour where
  // they were headed. Always sending them to /app stranded new caregivers on an
  // empty dashboard instead of the invitation they came to accept.
  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/app'} replace />;
  return <>{children}</>;
}

export default function App() {
  const { t } = useT();
  return (
    <>
      <a className="skip-link" href="#main">
        {t('skip_to_content')}
      </a>
      <Suspense fallback={<Spinner />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/medical-disclaimer" element={<MedicalDisclaimer />} />
          <Route path="/cookies" element={<Cookies />} />

          {/* Auth */}
          <Route
            path="/login"
            element={
              <RedirectIfSignedIn>
                <Login />
              </RedirectIfSignedIn>
            }
          />
          <Route
            path="/signup"
            element={
              <RedirectIfSignedIn>
                <Signup />
              </RedirectIfSignedIn>
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Caregiver invitation — reachable while signed out so the person can
              read what they are being asked to accept before creating an account. */}
          <Route path="/care/accept" element={<AcceptInvite />} />

          {/* Patient app */}
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Today />} />
            <Route path="medicines" element={<Medicines />} />
            <Route path="medicines/new" element={<MedicineForm />} />
            <Route path="medicines/:id/edit" element={<MedicineForm />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="appointments" element={<Appointments />} />
            <Route path="caregivers" element={<Caregivers />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Caregiver views */}
          <Route
            path="/care"
            element={
              <RequireAuth>
                <CarePatients />
              </RequireAuth>
            }
          />
          <Route
            path="/care/patients/:patientId"
            element={
              <RequireAuth>
                <CarePatientDetail />
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
