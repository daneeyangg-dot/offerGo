import { getUserStorageKey } from './auth';
import type { JobApplication } from '../types';

export function getApplications(userPhone: string): JobApplication[] {
  try {
    const raw = localStorage.getItem(getUserStorageKey(userPhone, 'applications'));
    return raw ? (JSON.parse(raw) as JobApplication[]) : [];
  } catch {
    return [];
  }
}

export function saveApplication(userPhone: string, app: JobApplication): void {
  const apps = getApplications(userPhone);
  apps.unshift(app);
  localStorage.setItem(getUserStorageKey(userPhone, 'applications'), JSON.stringify(apps));
}

export function updateApplication(
  userPhone: string,
  id: string,
  patch: Partial<JobApplication>
): void {
  const apps = getApplications(userPhone);
  const idx = apps.findIndex((a) => a.id === id);
  if (idx === -1) return;
  apps[idx] = { ...apps[idx], ...patch, updatedAt: Date.now() };
  localStorage.setItem(getUserStorageKey(userPhone, 'applications'), JSON.stringify(apps));
}

export function deleteApplication(userPhone: string, id: string): void {
  const apps = getApplications(userPhone).filter((a) => a.id !== id);
  localStorage.setItem(getUserStorageKey(userPhone, 'applications'), JSON.stringify(apps));
}
