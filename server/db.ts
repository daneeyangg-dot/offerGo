import { createClient, type Client } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _db: Client | null = null;

function getClient(): Client {
  if (!_db) {
    const databaseUrl = process.env.TURSO_DATABASE_URL || `file:${path.resolve(__dirname, '../data/app.db')}`;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    _db = createClient({
      url: databaseUrl,
      ...(authToken ? { authToken } : {}),
    });
  }
  return _db;
}

// Lazy re-export for backward compat
export const db: Client = new Proxy({} as Client, {
  get(_target, prop) {
    const client = getClient();
    const value = client[prop as keyof Client];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export async function initDb(): Promise<void> {
  const client = getClient();
  await client.batch([
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
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_phone TEXT NOT NULL,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
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
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS drafts (
      user_phone TEXT NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_phone, type)
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
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS interview_history (
      id TEXT PRIMARY KEY,
      user_phone TEXT NOT NULL,
      type TEXT NOT NULL,
      jd TEXT,
      resume TEXT,
      questions TEXT,
      created_at INTEGER NOT NULL
    )`,
  ]);
}

// Helper to safely get a single row
export async function getRow<T = Record<string, unknown>>(
  sql: string,
  args: (string | number | null | undefined)[]
): Promise<T | undefined> {
  const result = await getClient().execute({ sql, args });
  return result.rows[0] as T | undefined;
}

// Helper to get all rows
export async function getRows<T = Record<string, unknown>>(
  sql: string,
  args: (string | number | null | undefined)[]
): Promise<T[]> {
  const result = await getClient().execute({ sql, args });
  return result.rows as T[];
}

// Helper to execute insert/update/delete
export async function runQuery(
  sql: string,
  args: (string | number | null | undefined)[]
): Promise<{ changes: number }> {
  const result = await getClient().execute({ sql, args });
  return { changes: result.rowsAffected };
}

export interface UserRow {
  phone: string;
  salt: string;
  password_hash: string;
  created_at: number;
}

export interface JDRow {
  id: string;
  user_phone: string;
  company: string;
  position: string;
  content: string;
  created_at: number;
}

export interface ResumeRow {
  id: string;
  user_phone: string;
  name: string;
  content: string;
  updated_at: number;
}

export interface ApplicationRow {
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

export interface DraftRow {
  user_phone: string;
  type: string;
  data: string;
  updated_at: number;
}

export interface AnalysisHistoryRow {
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

export interface InterviewHistoryRow {
  id: string;
  user_phone: string;
  type: string;
  jd: string;
  resume: string;
  questions: string;
  created_at: number;
}
