/**
 * Typed endpoint definitions.
 *
 * Request shapes come from `@medtrack/shared`, so the client and the server are
 * validating against the same schemas rather than two hand-kept copies.
 */

import type {
  AdherenceSummary,
  Alert,
  Appointment,
  CarePermissions,
  DailyAdherencePoint,
  DoseEvent,
  Insight,
  Medicine,
  MedicineAdherence,
  User,
} from '@medtrack/shared';
import { api } from './client.js';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MedicineWithStock extends Medicine {
  dosesRemaining: number | null;
  projectedRunOut: string | null;
}

export interface TodayResponse {
  date: string;
  timezone: string;
  upcoming: DoseEvent[];
  taken: DoseEvent[];
  missed: DoseEvent[];
  skipped: DoseEvent[];
}

export interface AnalyticsResponse {
  window: { from: string; to: string; days: number; timezone: string };
  summary: AdherenceSummary;
  perMedicine: MedicineAdherence[];
  daily: DailyAdherencePoint[];
  insights: Insight[];
}

export interface CaregiverEntry {
  id: string;
  email: string;
  relation: string;
  status: string;
  permissions: CarePermissions;
  invitedAt: string;
  respondedAt: string | null;
}

export interface PatientEntry {
  careLinkId: string;
  patientId: string;
  name: string;
  timezone: string;
  relation: string;
  permissions: CarePermissions;
}

export interface PatientOverview {
  patient: { id: string; name: string; timezone: string };
  today: Omit<TodayResponse, 'date' | 'timezone'>;
  summary: AdherenceSummary;
  perMedicine: MedicineAdherence[];
  daily: DailyAdherencePoint[];
}

export const authApi = {
  signup: (body: unknown) => api.post<AuthResponse>('/auth/signup', body, { anonymous: true }),
  login: (body: unknown) => api.post<AuthResponse>('/auth/login', body, { anonymous: true }),
  me: () => api.get<{ user: User }>('/auth/me'),
  updateProfile: (body: unknown) => api.patch<{ user: User }>('/auth/me', body),
  logout: () => api.post<void>('/auth/logout'),
  logoutAll: () => api.post<{ message: string }>('/auth/logout-all'),
  changePassword: (body: unknown) => api.post<AuthResponse & { message: string }>('/auth/change-password', body),
  forgotPassword: (body: unknown) =>
    api.post<{ message: string }>('/auth/forgot-password', body, { anonymous: true }),
  resetPassword: (body: unknown) =>
    api.post<{ message: string }>('/auth/reset-password', body, { anonymous: true }),
};

export const medicinesApi = {
  list: (includeArchived = false) =>
    api.get<{ medicines: MedicineWithStock[] }>(
      `/medicines${includeArchived ? '?includeArchived=true' : ''}`,
    ),
  get: (id: string) => api.get<{ medicine: MedicineWithStock }>(`/medicines/${id}`),
  create: (body: unknown) => api.post<{ medicine: Medicine }>('/medicines', body),
  update: (id: string, body: unknown) => api.patch<{ medicine: Medicine }>(`/medicines/${id}`, body),
  archive: (id: string) => api.delete<{ message: string }>(`/medicines/${id}`),
  restore: (id: string) => api.post<{ medicine: Medicine }>(`/medicines/${id}/restore`),
  refill: (id: string, units: number) =>
    api.post<{ medicine: Medicine; dosesRemaining: number | null }>(`/medicines/${id}/refill`, {
      units,
    }),
};

export const dosesApi = {
  today: () => api.get<TodayResponse>('/doses/today'),
  list: (params: { from?: string; to?: string; medicineId?: string } = {}) => {
    const query = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== undefined) as [string, string][],
    );
    return api.get<{ doses: DoseEvent[]; window: { from: string; to: string; timezone: string } }>(
      `/doses?${query.toString()}`,
    );
  },
  analytics: (days = 30) => api.get<AnalyticsResponse>(`/doses/analytics?days=${days}`),
  take: (id: string, takenAt?: string) =>
    api.post<{ dose: DoseEvent }>(`/doses/${id}/take`, takenAt ? { takenAt } : {}),
  snooze: (id: string, minutes: number) =>
    api.post<{ dose: DoseEvent }>(`/doses/${id}/snooze`, { minutes }),
  skip: (id: string, reason?: string) =>
    api.post<{ dose: DoseEvent }>(`/doses/${id}/skip`, { reason: reason ?? null }),
  undo: (id: string) => api.post<{ dose: DoseEvent }>(`/doses/${id}/undo`),
  logAdHoc: (medicineId: string) =>
    api.post<{ dose: DoseEvent }>('/doses/ad-hoc', { medicineId }),
};

export const appointmentsApi = {
  list: (scope: 'upcoming' | 'past' = 'upcoming') =>
    api.get<{ appointments: Appointment[]; today: string; timezone: string }>(
      `/appointments?scope=${scope}`,
    ),
  create: (body: unknown) => api.post<{ appointment: Appointment }>('/appointments', body),
  update: (id: string, body: unknown) =>
    api.patch<{ appointment: Appointment }>(`/appointments/${id}`, body),
  remove: (id: string) => api.delete<void>(`/appointments/${id}`),
};

export const careApi = {
  caregivers: () => api.get<{ caregivers: CaregiverEntry[] }>('/care/caregivers'),
  invite: (body: unknown) => api.post<{ caregiver: CaregiverEntry }>('/care/caregivers', body),
  updateCaregiver: (id: string, body: unknown) =>
    api.patch<{ caregiver: CaregiverEntry }>(`/care/caregivers/${id}`, body),
  revoke: (id: string) => api.delete<{ message: string }>(`/care/caregivers/${id}`),
  invitation: (token: string) =>
    api.get<{
      invitation: { patientName: string; relation: string; permissions: CarePermissions; expiresAt: string };
    }>(`/care/invitations/${token}`, { anonymous: true }),
  respond: (token: string, accept: boolean) =>
    api.post<{ message: string }>('/care/invitations/respond', { token, accept }),
  patients: () => api.get<{ patients: PatientEntry[] }>('/care/patients'),
  overview: (patientId: string) =>
    api.get<PatientOverview>(`/care/patients/${patientId}/overview`),
  patientMedicines: (patientId: string) =>
    api.get<{ medicines: Medicine[] }>(`/care/patients/${patientId}/medicines`),
};

export const alertsApi = {
  list: () => api.get<{ alerts: Alert[]; unacknowledged: number }>('/alerts'),
  acknowledge: (id: string) => api.post<{ alert: Alert }>(`/alerts/${id}/acknowledge`),
  sos: (message?: string) =>
    api.post<{ caregiversNotified: number; message: string }>('/alerts/sos', {
      message: message ?? null,
    }),
};

export const accountApi = {
  consents: () => api.get<{ consents: unknown[]; currentVersions: Record<string, string> }>('/account/consents'),
  updateConsent: (body: unknown) => api.post<{ consents: unknown[] }>('/account/consents', body),
  requestDeletion: (body: unknown) =>
    api.post<{ message: string; purgeAt: string; graceDays: number }>('/account/delete', body),
  cancelDeletion: () => api.post<{ message: string }>('/account/delete/cancel'),
  /** Export downloads as a file, so it bypasses the JSON client. */
  exportUrl: () => `${import.meta.env['VITE_API_URL'] ?? '/api'}/account/export`,
};
