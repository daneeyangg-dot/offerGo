import { getApplications as apiGetApplications, createApplication as apiCreateApplication, updateApplication as apiUpdateApplication, deleteApplication as apiDeleteApplication } from './api';
import type { JobApplication } from '../types';

export async function getApplications(_userPhone: string): Promise<JobApplication[]> {
  try {
    const apps = await apiGetApplications();
    return apps.map(a => ({
      id: a.id,
      company: a.company,
      position: a.position,
      jd: a.jd,
      tailoredResume: a.tailoredResume,
      coverLetter: a.coverLetter,
      status: a.status as JobApplication['status'],
      priority: a.priority as JobApplication['priority'],
      notes: a.notes,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function saveApplication(_userPhone: string, app: JobApplication): Promise<void> {
  await apiCreateApplication(app);
}

export async function updateApplication(
  _userPhone: string,
  id: string,
  patch: Partial<JobApplication>
): Promise<void> {
  await apiUpdateApplication(id, patch);
}

export async function deleteApplication(_userPhone: string, id: string): Promise<void> {
  await apiDeleteApplication(id);
}
