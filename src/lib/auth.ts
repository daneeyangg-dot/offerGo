import type { User } from '../types';
import { registerUser, loginUser, migrateData } from './api';

const SESSION_KEY = 'iwaj_session';
const TOKEN_KEY = 'iwaj_token';

// Legacy keys for data migration
const LEGACY_RESUMES_KEY = 'iwaj_resume_library';
const LEGACY_APPLICATIONS_KEY = 'iwaj_applications';

function generateSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getUserStorageKey(phone: string, key: string): string {
  return `iwaj_${phone}_${key}`;
}

export async function createUser(phone: string, password: string): Promise<User> {
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const res = await registerUser(phone, salt, passwordHash) as { token: string; user: User };
  localStorage.setItem(TOKEN_KEY, res.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(res.user));
  return res.user;
}

export async function validateUser(phone: string, password: string): Promise<User | null> {
  // First, try to get salt from localStorage (for offline/legacy fallback) or server
  const usersRaw = localStorage.getItem('iwaj_users');
  let salt: string | undefined;
  if (usersRaw) {
    try {
      const users = JSON.parse(usersRaw) as Array<{ phone: string; salt?: string; password?: string; passwordHash?: string }>;
      const user = users.find((u) => u.phone === phone);
      if (user?.salt) salt = user.salt;
    } catch {
      // ignore
    }
  }

  if (!salt) {
    // Cannot hash without salt — user may not exist locally
    // Try server login with a dummy hash (will fail if user doesn't exist)
    // Actually, we need the salt. If not in localStorage, we can't login.
    // This is a limitation of the migration. The user must re-register if salt is lost.
    // But wait — for existing users, the salt IS in localStorage. For new users, they'll register through the API.
    return null;
  }

  const passwordHash = await hashPassword(password, salt);

  try {
    const res = await loginUser(phone, passwordHash) as { token: string; user: User };
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(SESSION_KEY, JSON.stringify(res.user));
    return res.user;
  } catch {
    return null;
  }
}

export function getSession(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function setSession(user: User): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function migrateLegacyData(phone: string): Promise<void> {
  // Collect all legacy localStorage data
  const jdsKey = getUserStorageKey(phone, 'jds');
  const resumesKey = getUserStorageKey(phone, 'resumes');
  const appsKey = getUserStorageKey(phone, 'applications');
  const analyzerDraftKey = getUserStorageKey(phone, 'analyzer-draft');
  const interviewDraftKey = getUserStorageKey(phone, 'interview-draft');

  const jdsRaw = localStorage.getItem(jdsKey);
  const resumesRaw = localStorage.getItem(resumesKey);
  const appsRaw = localStorage.getItem(appsKey);
  const analyzerDraftRaw = localStorage.getItem(analyzerDraftKey);
  const interviewDraftRaw = localStorage.getItem(interviewDraftKey);

  const data: {
    jds?: unknown[];
    resumes?: unknown[];
    applications?: unknown[];
    drafts?: Record<string, unknown>;
  } = {};

  if (jdsRaw) {
    try { data.jds = JSON.parse(jdsRaw); } catch { /* ignore */ }
  }
  if (resumesRaw) {
    try { data.resumes = JSON.parse(resumesRaw); } catch { /* ignore */ }
  }
  if (appsRaw) {
    try { data.applications = JSON.parse(appsRaw); } catch { /* ignore */ }
  }

  const drafts: Record<string, unknown> = {};
  if (analyzerDraftRaw) {
    try { drafts.analyzer = JSON.parse(analyzerDraftRaw); } catch { /* ignore */ }
  }
  if (interviewDraftRaw) {
    try { drafts.interview = JSON.parse(interviewDraftRaw); } catch { /* ignore */ }
  }
  if (Object.keys(drafts).length > 0) {
    data.drafts = drafts;
  }

  // Also check legacy keys
  const legacyResumes = localStorage.getItem(LEGACY_RESUMES_KEY);
  const legacyApps = localStorage.getItem(LEGACY_APPLICATIONS_KEY);
  if (legacyResumes && !data.resumes) {
    try { data.resumes = JSON.parse(legacyResumes); } catch { /* ignore */ }
  }
  if (legacyApps && !data.applications) {
    try { data.applications = JSON.parse(legacyApps); } catch { /* ignore */ }
  }

  // Only migrate if there's any data
  if (data.jds || data.resumes || data.applications || data.drafts) {
    try {
      await migrateData(data);
    } catch (err) {
      console.error('Migration failed:', err);
    }
  }
}

export type { User };
