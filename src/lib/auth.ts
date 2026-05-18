import type { User } from '../types';

const USERS_KEY = 'iwaj_users';
const SESSION_KEY = 'iwaj_session';
const PBKDF2_ITERATIONS = 100_000;

// Legacy keys for data migration
const LEGACY_RESUMES_KEY = 'iwaj_resume_library';
const LEGACY_APPLICATIONS_KEY = 'iwaj_applications';

interface LegacyUser {
  phone: string;
  password?: string;
  salt?: string;
  passwordHash?: string;
  createdAt: number;
}

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
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function readUsersRaw(): LegacyUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as LegacyUser[]) : [];
  } catch {
    return [];
  }
}

export function getUsers(): User[] {
  return readUsersRaw().filter(
    (u): u is User => typeof u.salt === 'string' && typeof u.passwordHash === 'string'
  );
}

export async function createUser(phone: string, password: string): Promise<User> {
  const users = readUsersRaw();
  if (users.find((u) => u.phone === phone)) {
    throw new Error('该手机号已注册');
  }
  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const user: User = { phone, salt, passwordHash, createdAt: Date.now() };
  users.push(user);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return user;
}

export async function validateUser(phone: string, password: string): Promise<User | null> {
  const users = readUsersRaw();
  const idx = users.findIndex((u) => u.phone === phone);
  if (idx === -1) return null;
  const stored = users[idx];

  // Migrate legacy plaintext-password records on successful login.
  if (!stored.passwordHash && stored.password) {
    if (stored.password !== password) return null;
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const migrated: User = { phone, salt, passwordHash, createdAt: stored.createdAt };
    users[idx] = migrated;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    return migrated;
  }

  if (!stored.salt || !stored.passwordHash) return null;
  const candidate = await hashPassword(password, stored.salt);
  if (candidate !== stored.passwordHash) return null;
  return { phone, salt: stored.salt, passwordHash: stored.passwordHash, createdAt: stored.createdAt };
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
}

export function getUserStorageKey(phone: string, key: string): string {
  return `iwaj_${phone}_${key}`;
}

export function migrateLegacyData(phone: string): void {
  const userResumesKey = getUserStorageKey(phone, 'resumes');
  const userAppsKey = getUserStorageKey(phone, 'applications');

  const legacyResumes = localStorage.getItem(LEGACY_RESUMES_KEY);
  if (legacyResumes && !localStorage.getItem(userResumesKey)) {
    localStorage.setItem(userResumesKey, legacyResumes);
    localStorage.removeItem(LEGACY_RESUMES_KEY);
  }

  const legacyApps = localStorage.getItem(LEGACY_APPLICATIONS_KEY);
  if (legacyApps && !localStorage.getItem(userAppsKey)) {
    localStorage.setItem(userAppsKey, legacyApps);
    localStorage.removeItem(LEGACY_APPLICATIONS_KEY);
  }
}

export type { User };
