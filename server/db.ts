import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');
const dbPath = path.join(dataDir, 'app.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize tables
const initStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    phone TEXT PRIMARY KEY,
    salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS jds (
    id TEXT PRIMARY KEY,
    user_phone TEXT NOT NULL,
    company TEXT NOT NULL,
    position TEXT,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS resumes (
    id TEXT PRIMARY KEY,
    user_phone TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    user_phone TEXT NOT NULL,
    company TEXT NOT NULL,
    position TEXT NOT NULL,
    jd TEXT,
    tailored_resume TEXT,
    cover_letter TEXT,
    status TEXT NOT NULL,
    priority TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS drafts (
    user_phone TEXT NOT NULL,
    type TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_phone, type),
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS analysis_history (
    id TEXT PRIMARY KEY,
    user_phone TEXT NOT NULL,
    company TEXT,
    position TEXT,
    jd TEXT,
    resume TEXT,
    extra_docs TEXT,
    fit_rating TEXT,
    role_type TEXT,
    seniority_level TEXT,
    score INTEGER,
    key_reasons TEXT,
    recommendation TEXT,
    optimized_resume TEXT,
    cover_letter TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS interview_history (
    id TEXT PRIMARY KEY,
    user_phone TEXT NOT NULL,
    type TEXT NOT NULL,
    jd TEXT,
    resume TEXT,
    questions TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE
  )`,
];

for (const stmt of initStatements) {
  db.exec(stmt);
}

// Helper type for statement results
interface UserRow {
  phone: string;
  salt: string;
  password_hash: string;
  created_at: number;
}

interface JDRow {
  id: string;
  user_phone: string;
  company: string;
  position: string;
  content: string;
  created_at: number;
}

interface ResumeRow {
  id: string;
  user_phone: string;
  name: string;
  content: string;
  updated_at: number;
}

interface ApplicationRow {
  id: string;
  user_phone: string;
  company: string;
  position: string;
  jd: string;
  tailored_resume: string;
  cover_letter: string;
  status: string;
  priority: string;
  notes: string;
  created_at: number;
  updated_at: number;
}

interface DraftRow {
  user_phone: string;
  type: string;
  data: string;
  updated_at: number;
}

interface AnalysisHistoryRow {
  id: string;
  user_phone: string;
  company: string;
  position: string;
  jd: string;
  resume: string;
  extra_docs: string;
  fit_rating: string;
  role_type: string;
  seniority_level: string;
  score: number;
  key_reasons: string;
  recommendation: string;
  optimized_resume: string;
  cover_letter: string;
  created_at: number;
}

interface InterviewHistoryRow {
  id: string;
  user_phone: string;
  type: string;
  jd: string;
  resume: string;
  questions: string;
  created_at: number;
}

// Use `as any` to bypass better-sqlite3's strict typing while keeping runtime safety
// The SQL uses positional params (?) and we call .run()/.get() with arrays

// Prepared statements for users
export const userStmts = {
  findByPhone: db.prepare('SELECT * FROM users WHERE phone = ?') as any as {
    get(phone: string): UserRow | undefined;
  },
  insert: db.prepare('INSERT INTO users (phone, salt, password_hash, created_at) VALUES (?, ?, ?, ?)') as any as {
    run(phone: string, salt: string, passwordHash: string, createdAt: number): { changes: number };
  },
};

// Prepared statements for JDs
export const jdStmts = {
  findByUser: db.prepare('SELECT * FROM jds WHERE user_phone = ? ORDER BY created_at DESC') as any as {
    all(userPhone: string): JDRow[];
  },
  insert: db.prepare('INSERT INTO jds (id, user_phone, company, position, content, created_at) VALUES (?, ?, ?, ?, ?, ?)') as any as {
    run(id: string, userPhone: string, company: string, position: string, content: string, createdAt: number): { changes: number };
  },
  update: db.prepare('UPDATE jds SET company = ?, position = ?, content = ? WHERE id = ? AND user_phone = ?') as any as {
    run(company: string, position: string, content: string, id: string, userPhone: string): { changes: number };
  },
  delete: db.prepare('DELETE FROM jds WHERE id = ? AND user_phone = ?') as any as {
    run(id: string, userPhone: string): { changes: number };
  },
};

// Prepared statements for resumes
export const resumeStmts = {
  findByUser: db.prepare('SELECT * FROM resumes WHERE user_phone = ? ORDER BY updated_at DESC') as any as {
    all(userPhone: string): ResumeRow[];
  },
  insert: db.prepare('INSERT INTO resumes (id, user_phone, name, content, updated_at) VALUES (?, ?, ?, ?, ?)') as any as {
    run(id: string, userPhone: string, name: string, content: string, updatedAt: number): { changes: number };
  },
  update: db.prepare('UPDATE resumes SET name = ?, content = ?, updated_at = ? WHERE id = ? AND user_phone = ?') as any as {
    run(name: string, content: string, updatedAt: number, id: string, userPhone: string): { changes: number };
  },
  delete: db.prepare('DELETE FROM resumes WHERE id = ? AND user_phone = ?') as any as {
    run(id: string, userPhone: string): { changes: number };
  },
};

// Prepared statements for applications
export const appStmts = {
  findByUser: db.prepare('SELECT * FROM applications WHERE user_phone = ? ORDER BY updated_at DESC') as any as {
    all(userPhone: string): ApplicationRow[];
  },
  insert: db.prepare('INSERT INTO applications (id, user_phone, company, position, jd, tailored_resume, cover_letter, status, priority, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)') as any as {
    run(
      id: string, userPhone: string, company: string, position: string,
      jd: string, tailoredResume: string, coverLetter: string,
      status: string, priority: string, notes: string,
      createdAt: number, updatedAt: number
    ): { changes: number };
  },
  update: db.prepare('UPDATE applications SET company = ?, position = ?, jd = ?, tailored_resume = ?, cover_letter = ?, status = ?, priority = ?, notes = ?, updated_at = ? WHERE id = ? AND user_phone = ?') as any as {
    run(
      company: string, position: string, jd: string, tailoredResume: string, coverLetter: string,
      status: string, priority: string, notes: string, updatedAt: number,
      id: string, userPhone: string
    ): { changes: number };
  },
  delete: db.prepare('DELETE FROM applications WHERE id = ? AND user_phone = ?') as any as {
    run(id: string, userPhone: string): { changes: number };
  },
};

// Prepared statements for drafts
export const draftStmts = {
  findByUserAndType: db.prepare('SELECT * FROM drafts WHERE user_phone = ? AND type = ?') as any as {
    get(userPhone: string, type: string): DraftRow | undefined;
  },
  upsert: db.prepare('INSERT INTO drafts (user_phone, type, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_phone, type) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at') as any as {
    run(userPhone: string, type: string, data: string, updatedAt: number): { changes: number };
  },
};

// Prepared statements for analysis history
export const analysisHistoryStmts = {
  findByUser: db.prepare('SELECT * FROM analysis_history WHERE user_phone = ? ORDER BY created_at DESC') as any as {
    all(userPhone: string): AnalysisHistoryRow[];
  },
  findById: db.prepare('SELECT * FROM analysis_history WHERE id = ? AND user_phone = ?') as any as {
    get(id: string, userPhone: string): AnalysisHistoryRow | undefined;
  },
  insert: db.prepare('INSERT INTO analysis_history (id, user_phone, company, position, jd, resume, extra_docs, fit_rating, role_type, seniority_level, score, key_reasons, recommendation, optimized_resume, cover_letter, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)') as any as {
    run(
      id: string, userPhone: string, company: string, position: string,
      jd: string, resume: string, extraDocs: string,
      fitRating: string, roleType: string, seniorityLevel: string, score: number,
      keyReasons: string, recommendation: string,
      optimizedResume: string, coverLetter: string, createdAt: number
    ): { changes: number };
  },
  delete: db.prepare('DELETE FROM analysis_history WHERE id = ? AND user_phone = ?') as any as {
    run(id: string, userPhone: string): { changes: number };
  },
};

// Prepared statements for interview history
export const interviewHistoryStmts = {
  findByUser: db.prepare('SELECT * FROM interview_history WHERE user_phone = ? ORDER BY created_at DESC') as any as {
    all(userPhone: string): InterviewHistoryRow[];
  },
  findById: db.prepare('SELECT * FROM interview_history WHERE id = ? AND user_phone = ?') as any as {
    get(id: string, userPhone: string): InterviewHistoryRow | undefined;
  },
  insert: db.prepare('INSERT INTO interview_history (id, user_phone, type, jd, resume, questions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)') as any as {
    run(
      id: string, userPhone: string, type: string,
      jd: string, resume: string, questions: string, createdAt: number
    ): { changes: number };
  },
  delete: db.prepare('DELETE FROM interview_history WHERE id = ? AND user_phone = ?') as any as {
    run(id: string, userPhone: string): { changes: number };
  },
};
