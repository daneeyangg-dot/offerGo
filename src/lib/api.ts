const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('iwaj_token');
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.error || json.details || text;
    } catch {
      // use raw text
    }
    throw new Error(`API 错误 (${res.status}): ${detail}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }
  return res.text();
}

// Auth
export function registerUser(phone: string, salt: string, passwordHash: string) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ phone, salt, passwordHash }),
  });
}

export function loginUser(phone: string, passwordHash: string) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ phone, passwordHash }),
  });
}

export function migrateData(data: {
  jds?: unknown[];
  resumes?: unknown[];
  applications?: unknown[];
  drafts?: Record<string, unknown>;
}) {
  return apiFetch('/auth/migrate', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updatePassword(salt: string, passwordHash: string) {
  return apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ salt, passwordHash }),
  });
}

export function getSalt(phone: string) {
  return apiFetch(`/auth/salt?phone=${encodeURIComponent(phone)}`) as Promise<{ salt: string }>;
}

export function resetPassword(phone: string, securityKey: string, salt: string, passwordHash: string) {
  return apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ phone, securityKey, salt, passwordHash }),
  });
}


// JDs
export function getJDs() {
  return apiFetch('/jds') as Promise<Array<{ id: string; company: string; position: string; content: string; createdAt: number }>>;
}

export function createJD(jd: { id: string; company: string; position: string; content: string; createdAt: number }) {
  return apiFetch('/jds', { method: 'POST', body: JSON.stringify(jd) });
}

export function updateJD(id: string, jd: { company: string; position: string; content: string }) {
  return apiFetch(`/jds/${id}`, { method: 'PUT', body: JSON.stringify(jd) });
}

export function deleteJD(id: string) {
  return apiFetch(`/jds/${id}`, { method: 'DELETE' });
}

// Resumes
export function getResumes() {
  return apiFetch('/resumes') as Promise<Array<{ id: string; name: string; content: string; updatedAt: number }>>;
}

export function createResume(resume: { id: string; name: string; content: string; updatedAt: number }) {
  return apiFetch('/resumes', { method: 'POST', body: JSON.stringify(resume) });
}

export function updateResume(id: string, resume: { name: string; content: string }) {
  return apiFetch(`/resumes/${id}`, { method: 'PUT', body: JSON.stringify(resume) });
}

export function deleteResume(id: string) {
  return apiFetch(`/resumes/${id}`, { method: 'DELETE' });
}

// Applications
export function getApplications() {
  return apiFetch('/applications') as Promise<Array<{
    id: string; company: string; position: string;
    jd: string; tailoredResume: string; coverLetter: string;
    status: string; priority: string; notes: string;
    createdAt: number; updatedAt: number;
  }>>;
}

export function createApplication(app: {
  id: string; company: string; position: string;
  jd?: string; tailoredResume?: string; coverLetter?: string;
  status: string; priority: string; notes?: string;
  createdAt: number; updatedAt: number;
}) {
  return apiFetch('/applications', { method: 'POST', body: JSON.stringify(app) });
}

export function updateApplication(id: string, app: Partial<{
  company: string; position: string;
  jd: string; tailoredResume: string; coverLetter: string;
  status: string; priority: string; notes: string;
}>) {
  return apiFetch(`/applications/${id}`, { method: 'PUT', body: JSON.stringify(app) });
}

export function deleteApplication(id: string) {
  return apiFetch(`/applications/${id}`, { method: 'DELETE' });
}

// Drafts
export function getDraft(type: string) {
  return apiFetch(`/drafts/${type}`) as Promise<{ type: string; data: unknown; updatedAt: number } | null>;
}

export function saveDraft(type: string, data: unknown) {
  return apiFetch(`/drafts/${type}`, { method: 'PUT', body: JSON.stringify({ data }) });
}

// Analysis History
export interface AnalysisHistoryItem {
  id: string;
  company: string;
  position: string;
  jd: string;
  resume: string;
  extraDocs: string;
  fitRating: string;
  roleType: string;
  seniorityLevel: string;
  score: number;
  keyReasons: string[];
  recommendation: string;
  optimizedResume: string;
  coverLetter: string;
  createdAt: number;
}

export function getAnalysisHistory() {
  return apiFetch('/analysis-history') as Promise<AnalysisHistoryItem[]>;
}

export function getAnalysisHistoryDetail(id: string) {
  return apiFetch(`/analysis-history/${id}`) as Promise<AnalysisHistoryItem>;
}

export function createAnalysisHistory(item: Omit<AnalysisHistoryItem, 'createdAt'>) {
  return apiFetch('/analysis-history', { method: 'POST', body: JSON.stringify(item) });
}

export function deleteAnalysisHistory(id: string) {
  return apiFetch(`/analysis-history/${id}`, { method: 'DELETE' });
}

// Interview History
export interface InterviewHistoryItem {
  id: string;
  type: 'technical' | 'behavioral';
  jd: string;
  resume: string;
  questions: unknown[];
  createdAt: number;
}

export function getInterviewHistory() {
  return apiFetch('/interview-history') as Promise<InterviewHistoryItem[]>;
}

export function getInterviewHistoryDetail(id: string) {
  return apiFetch(`/interview-history/${id}`) as Promise<InterviewHistoryItem>;
}

export function loadInterviewHistoryItem(
  id: string,
  setters: {
    setJd: (v: string) => void;
    setResume: (v: string) => void;
    setTechQuestions: (v: unknown[]) => void;
    setBehavioralQuestions: (v: unknown[]) => void;
    setActiveTab: (v: 'technical' | 'behavioral' | 'simulation') => void;
  }
) {
  return getInterviewHistoryDetail(id).then((item) => {
    setters.setJd(item.jd || '');
    setters.setResume(item.resume || '');
    const questions = item.questions || [];
    if (item.type === 'technical') {
      setters.setTechQuestions(questions);
      setters.setActiveTab('technical');
    } else {
      setters.setBehavioralQuestions(questions);
      setters.setActiveTab('behavioral');
    }
  });
}

export function createInterviewHistory(item: Omit<InterviewHistoryItem, 'createdAt'>) {
  return apiFetch('/interview-history', { method: 'POST', body: JSON.stringify(item) });
}

export function deleteInterviewHistory(id: string) {
  return apiFetch(`/interview-history/${id}`, { method: 'DELETE' });
}
