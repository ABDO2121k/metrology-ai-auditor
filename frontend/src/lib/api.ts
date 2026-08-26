/**
 * Single place the frontend talks to the gateway.
 *
 * The base URL was previously hardcoded as http://localhost:8000 in every page,
 * which meant the app only worked when served from the developer's own machine.
 * It now comes from the environment, defaulting to localhost for local runs.
 */

const CONFIGURED_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/**
 * Where the gateway lives.
 *
 * An empty value means *same origin*: requests go to `/api/v1/...` relative to
 * whatever host served the page. That is the right answer behind the nginx in
 * docker-compose.prod.yml, which serves the app and proxies /api from one
 * origin — and it means the deployment works unchanged on an IP, a domain, or
 * an SSH tunnel to localhost. Since Next.js inlines NEXT_PUBLIC_* at build
 * time, an absolute URL here would otherwise have to be rebuilt every time the
 * address changed.
 *
 * Leaving the variable unset entirely keeps the local development default,
 * where `next dev` serves :3000 and the gateway runs separately on :8000.
 */
export const API_BASE =
  CONFIGURED_BASE === undefined
    ? 'http://localhost:8000'
    : CONFIGURED_BASE.replace(/\/$/, '');

export const TOKEN_KEY = 'jwt_token';
export const USER_KEY = 'jwt_user';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set for FormData uploads, where the browser must pick the boundary. */
  rawBody?: BodyInit;
}

/**
 * Authenticated fetch against the gateway.
 *
 * A 401 clears the session and bounces to /login: leaving a stale token in
 * localStorage produces an app that looks signed in but fails every request.
 */
export async function apiFetch<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, rawBody, headers, ...rest } = options;
  const token = getToken();

  const finalHeaders: Record<string, string> = {
    ...(headers as Record<string, string>),
  };
  if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: finalHeaders,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError('Session expired. Please sign in again.', 401);
  }

  const text = await res.text();
  let payload: any = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && (payload.error || payload.detail || payload.message)) ||
      `Request failed with status ${res.status}`;
    throw new ApiError(typeof message === 'string' ? message : JSON.stringify(message), res.status);
  }

  return payload as T;
}

// --- Domain types ---------------------------------------------------------

export interface Certificate {
  id: string;
  certificate_number: string;
  original_filename: string;
  file_path_s3: string;
  file_hash_sha256: string;
  status: string;
  page_count: number;
  announced_page_count: number;
  client_name: string;
  instrument_name: string;
  instrument_serial: string;
  issue_date: string | null;
  calibration_date: string | null;
  next_calibration_date: string | null;
  ambient_temperature: string;
  ambient_humidity: string;
  ocr_confidence: number | null;
  extraction_quality: string;
  conformity_status: string;
  ocr_error?: string;
  ocr_completed_at: string | null;
  created_at: string;
}

export interface MeasurementPoint {
  point_index: number;
  unit: string;
  parameter: string;
  nominal_value: number;
  reference_value: number;
  measured_value: number;
  calculated_error: number;
  calculated_correction: number;
  expanded_uncertainty_u: number;
  emt_limit: number;
  guard_band_sum: number;
  is_conforme: boolean;
  is_return_point: boolean;
  is_hysteresis_valid: boolean;
}

export interface AnomalyLog {
  id: string;
  anomaly_type: string;
  severity: string;
  description: string;
  ai_confidence_score: number;
  detected_at: string;
}

/** Tri-state: a greyscale scan cannot prove a cachet is absent. */
export type MarkStatus = 'PRESENT' | 'ABSENT' | 'NOT_VERIFIABLE';

export interface VisualValidation {
  validation_stamp_status: MarkStatus;
  signature_status: MarkStatus;
  lab_logo_present: boolean;
  accreditation_logo_present: boolean;
  validation_stamp_present: boolean;
  signatures_present: boolean;
  colour_capable_scan: boolean;
  letterhead_colour_percent: number;
  validation_zone_colour_percent: number;
  marks_found_on_pages: number[];
  evidence_notes: string[];
  operator_name: string | null;
  approver_name: string | null;
}

export interface CertificateOCR {
  certificate_id: string;
  status: string;
  extraction_quality: string;
  ocr_confidence: number | null;
  conformity_status: string;
  ocr_error: string;
  ocr_completed_at: string | null;
  measurements: MeasurementPoint[];
  anomalies: AnomalyLog[];
  extraction?: any;
}

export interface CertificateStats {
  total_certificates: number;
  by_status: Record<string, number>;
  pending: number;
  completed: number;
  failed: number;
  flagged: number;
  validated: number;
  total_points: number;
  /** Points belonging to a certificate whose conformity was actually decided. */
  judged_points: number;
  conforme_points: number;
  /** Measured over judged_points only, never over undecided ones. */
  compliance_percent: number;
  blocking_anomalies: number;
  undecided_certificates: number;
}

// --- Endpoints ------------------------------------------------------------

export const api = {
  login: (username: string, password: string) =>
    apiFetch<{ token: string; expires_at: number; user: AuthUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: { username, password },
    }),

  profile: () => apiFetch<AuthUser>('/api/v1/auth/profile'),

  changePassword: (current_password: string, new_password: string) =>
    apiFetch('/api/v1/auth/change-password', {
      method: 'PUT',
      body: { current_password, new_password },
    }),

  listCertificates: (params?: { status?: string; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    const suffix = query.toString() ? `?${query}` : '';
    return apiFetch<Certificate[]>(`/api/v1/certificates/${suffix}`);
  },

  certificateStats: () => apiFetch<CertificateStats>('/api/v1/certificates/stats'),

  getCertificate: (id: string) => apiFetch<Certificate>(`/api/v1/certificates/${id}`),

  getCertificateOCR: (id: string) => apiFetch<CertificateOCR>(`/api/v1/certificates/${id}/ocr`),

  reprocessCertificate: (id: string) =>
    apiFetch(`/api/v1/certificates/${id}/reprocess`, { method: 'POST' }),

  deleteCertificate: (id: string) =>
    apiFetch(`/api/v1/certificates/${id}`, { method: 'DELETE' }),

  uploadCertificate: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiFetch<{ certificate_id: string; s3_path: string; hash: string; status: string }>(
      '/api/v1/certificates/upload',
      { method: 'POST', rawBody: form },
    );
  },

  listUsers: () => apiFetch<AuthUser[]>('/api/v1/admin/users'),

  registerUser: (payload: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }) => apiFetch<AuthUser>('/api/v1/admin/users/register', { method: 'POST', body: payload }),

  resetUserPassword: (id: string, new_password: string) =>
    apiFetch(`/api/v1/admin/users/${id}/reset-password`, {
      method: 'PUT',
      body: { new_password },
    }),

  systemHealth: () =>
    apiFetch<{
      healthy_count: number;
      total_count: number;
      all_healthy: boolean;
      services: Array<{
        name: string;
        port: number;
        container: string;
        type: string;
        status: string;
        latency: number;
        detail?: string;
      }>;
    }>('/api/v1/admin/system/health'),

  analytics: () => apiFetch<any>('/api/v1/analytics/dashboard'),
};
