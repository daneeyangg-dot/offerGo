import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { initDb, getRow, getRows, runQuery } from './db.js';
import type {
  UserRow,
  JDRow,
  ResumeRow,
  ApplicationRow,
  DraftRow,
  AnalysisHistoryRow,
  InterviewHistoryRow,
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'iwaj-dev-secret-change-in-production';
const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(express.json({ limit: '10mb' }));

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Initialize DB on first request in serverless environments
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// Auth middleware
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未登录' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { phone: string };
    (req as any).userPhone = decoded.phone;
    next();
  } catch {
    res.status(401).json({ error: '登录已过期' });
  }
}

// ========== Auth Routes ==========

app.post('/api/auth/register', async (req, res) => {
  await ensureDb();
  const { phone, salt, passwordHash } = req.body;
  if (!phone || !salt || !passwordHash) {
    res.status(400).json({ error: '缺少必要字段' });
    return;
  }
  try {
    const existing = await getRow<UserRow>('SELECT * FROM users WHERE phone = ?', [phone]);
    if (existing) {
      res.status(409).json({ error: '该手机号已注册' });
      return;
    }
    await runQuery(
      'INSERT INTO users (phone, salt, password_hash, created_at) VALUES (?, ?, ?, ?)',
      [phone, salt, passwordHash, Date.now()]
    );
    const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { phone, createdAt: Date.now() } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: '注册失败' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  await ensureDb();
  const { phone, passwordHash } = req.body;
  if (!phone || !passwordHash) {
    res.status(400).json({ error: '缺少必要字段' });
    return;
  }
  try {
    const user = await getRow<UserRow>('SELECT * FROM users WHERE phone = ?', [phone]);
    if (!user || user.password_hash !== passwordHash) {
      res.status(401).json({ error: '手机号或密码错误' });
      return;
    }
    const token = jwt.sign({ phone }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { phone, createdAt: user.created_at } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '登录失败' });
  }
});

app.post('/api/auth/migrate', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { jds, resumes, applications, drafts } = req.body;

  try {
    if (Array.isArray(jds)) {
      for (const jd of jds) {
        try {
          await runQuery(
            'INSERT INTO jds (id, user_phone, company, position, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [jd.id, userPhone, jd.company, jd.position || '', jd.content, jd.createdAt || Date.now()]
          );
        } catch {
          // ignore duplicate
        }
      }
    }
    if (Array.isArray(resumes)) {
      for (const r of resumes) {
        try {
          await runQuery(
            'INSERT INTO resumes (id, user_phone, name, content, updated_at) VALUES (?, ?, ?, ?, ?)',
            [r.id, userPhone, r.name, r.content, r.updatedAt || Date.now()]
          );
        } catch {
          // ignore duplicate
        }
      }
    }
    if (Array.isArray(applications)) {
      for (const a of applications) {
        try {
          await runQuery(
            'INSERT INTO applications (id, user_phone, company, position, jd, tailored_resume, cover_letter, status, priority, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              a.id, userPhone, a.company, a.position,
              a.jd || '', a.tailoredResume || '', a.coverLetter || '',
              a.status, a.priority, a.notes || '',
              a.createdAt || Date.now(), a.updatedAt || Date.now(),
            ]
          );
        } catch {
          // ignore duplicate
        }
      }
    }
    if (typeof drafts === 'object') {
      for (const [type, data] of Object.entries(drafts)) {
        if (data) {
          await runQuery(
            'INSERT INTO drafts (user_phone, type, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_phone, type) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
            [userPhone, type, JSON.stringify(data), Date.now()]
          );
        }
      }
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Migrate error:', error);
    res.status(500).json({ error: '数据迁移失败' });
  }
});

// ========== JD Routes ==========

app.get('/api/jds', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  try {
    const rows = await getRows<JDRow>('SELECT * FROM jds WHERE user_phone = ? ORDER BY created_at DESC', [userPhone]);
    const jds = rows.map((r) => ({
      id: r.id,
      company: r.company,
      position: r.position,
      content: r.content,
      createdAt: r.created_at,
    }));
    res.json(jds);
  } catch (error) {
    console.error('Get JDs error:', error);
    res.status(500).json({ error: '获取 JD 失败' });
  }
});

app.post('/api/jds', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id, company, position, content, createdAt } = req.body;
  try {
    await runQuery(
      'INSERT INTO jds (id, user_phone, company, position, content, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userPhone, company, position || '', content, createdAt || Date.now()]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Create JD error:', error);
    res.status(500).json({ error: '创建 JD 失败' });
  }
});

app.put('/api/jds/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  const { company, position, content } = req.body;
  try {
    const result = await runQuery(
      'UPDATE jds SET company = ?, position = ?, content = ? WHERE id = ? AND user_phone = ?',
      [company, position || '', content, id, userPhone]
    );
    if (result.changes === 0) {
      res.status(404).json({ error: 'JD 不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update JD error:', error);
    res.status(500).json({ error: '更新 JD 失败' });
  }
});

app.delete('/api/jds/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  try {
    await runQuery('DELETE FROM jds WHERE id = ? AND user_phone = ?', [id, userPhone]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete JD error:', error);
    res.status(500).json({ error: '删除 JD 失败' });
  }
});

// ========== Resume Routes ==========

app.get('/api/resumes', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  try {
    const rows = await getRows<ResumeRow>('SELECT * FROM resumes WHERE user_phone = ? ORDER BY updated_at DESC', [userPhone]);
    const resumes = rows.map((r) => ({
      id: r.id,
      name: r.name,
      content: r.content,
      updatedAt: r.updated_at,
    }));
    res.json(resumes);
  } catch (error) {
    console.error('Get resumes error:', error);
    res.status(500).json({ error: '获取简历失败' });
  }
});

app.post('/api/resumes', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id, name, content, updatedAt } = req.body;
  try {
    await runQuery(
      'INSERT INTO resumes (id, user_phone, name, content, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, userPhone, name, content, updatedAt || Date.now()]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Create resume error:', error);
    res.status(500).json({ error: '创建简历失败' });
  }
});

app.put('/api/resumes/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  const { name, content } = req.body;
  try {
    const result = await runQuery(
      'UPDATE resumes SET name = ?, content = ?, updated_at = ? WHERE id = ? AND user_phone = ?',
      [name, content, Date.now(), id, userPhone]
    );
    if (result.changes === 0) {
      res.status(404).json({ error: '简历不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update resume error:', error);
    res.status(500).json({ error: '更新简历失败' });
  }
});

app.delete('/api/resumes/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  try {
    await runQuery('DELETE FROM resumes WHERE id = ? AND user_phone = ?', [id, userPhone]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete resume error:', error);
    res.status(500).json({ error: '删除简历失败' });
  }
});

// ========== Application Routes ==========

app.get('/api/applications', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  try {
    const rows = await getRows<ApplicationRow>(
      'SELECT * FROM applications WHERE user_phone = ? ORDER BY updated_at DESC',
      [userPhone]
    );
    const applications = rows.map((r) => ({
      id: r.id,
      company: r.company,
      position: r.position,
      jd: r.jd,
      tailoredResume: r.tailored_resume,
      coverLetter: r.cover_letter,
      status: r.status,
      priority: r.priority,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
    res.json(applications);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: '获取投递记录失败' });
  }
});

app.post('/api/applications', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id, company, position, jd, tailoredResume, coverLetter, status, priority, notes, createdAt, updatedAt } = req.body;
  try {
    await runQuery(
      'INSERT INTO applications (id, user_phone, company, position, jd, tailored_resume, cover_letter, status, priority, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id, userPhone, company, position,
        jd || '', tailoredResume || '', coverLetter || '',
        status, priority, notes || '',
        createdAt || Date.now(), updatedAt || Date.now(),
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Create application error:', error);
    res.status(500).json({ error: '创建投递记录失败' });
  }
});

app.put('/api/applications/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  const { company, position, jd, tailoredResume, coverLetter, status, priority, notes } = req.body;
  try {
    const result = await runQuery(
      'UPDATE applications SET company = ?, position = ?, jd = ?, tailored_resume = ?, cover_letter = ?, status = ?, priority = ?, notes = ?, updated_at = ? WHERE id = ? AND user_phone = ?',
      [
        company, position, jd || '', tailoredResume || '', coverLetter || '',
        status, priority, notes || '', Date.now(), id, userPhone,
      ]
    );
    if (result.changes === 0) {
      res.status(404).json({ error: '投递记录不存在' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ error: '更新投递记录失败' });
  }
});

app.delete('/api/applications/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  try {
    await runQuery('DELETE FROM applications WHERE id = ? AND user_phone = ?', [id, userPhone]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete application error:', error);
    res.status(500).json({ error: '删除投递记录失败' });
  }
});

// ========== Draft Routes ==========

app.get('/api/drafts/:type', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { type } = req.params;
  try {
    const row = await getRow<DraftRow>('SELECT * FROM drafts WHERE user_phone = ? AND type = ?', [userPhone, type]);
    if (!row) {
      res.json(null);
      return;
    }
    res.json({ type: row.type, data: JSON.parse(row.data), updatedAt: row.updated_at });
  } catch (error) {
    console.error('Get draft error:', error);
    res.status(500).json({ error: '获取草稿失败' });
  }
});

app.put('/api/drafts/:type', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { type } = req.params;
  const { data } = req.body;
  try {
    await runQuery(
      'INSERT INTO drafts (user_phone, type, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_phone, type) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
      [userPhone, type, JSON.stringify(data), Date.now()]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ error: '保存草稿失败' });
  }
});

// ========== Analysis History Routes ==========

app.get('/api/analysis-history', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  try {
    const rows = await getRows<AnalysisHistoryRow>(
      'SELECT * FROM analysis_history WHERE user_phone = ? ORDER BY created_at DESC',
      [userPhone]
    );
    const items = rows.map((r) => ({
      id: r.id,
      company: r.company,
      position: r.position,
      jd: r.jd,
      resume: r.resume,
      extraDocs: r.extra_docs,
      fitRating: r.fit_rating,
      roleType: r.role_type,
      seniorityLevel: r.seniority_level,
      score: r.score,
      keyReasons: r.key_reasons ? JSON.parse(r.key_reasons) : [],
      recommendation: r.recommendation,
      optimizedResume: r.optimized_resume,
      coverLetter: r.cover_letter,
      createdAt: r.created_at,
    }));
    res.json(items);
  } catch (error) {
    console.error('Get analysis history error:', error);
    res.status(500).json({ error: '获取分析历史失败' });
  }
});

app.get('/api/analysis-history/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  try {
    const row = await getRow<AnalysisHistoryRow>('SELECT * FROM analysis_history WHERE id = ? AND user_phone = ?', [id, userPhone]);
    if (!row) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    res.json({
      id: row.id,
      company: row.company,
      position: row.position,
      jd: row.jd,
      resume: row.resume,
      extraDocs: row.extra_docs,
      fitRating: row.fit_rating,
      roleType: row.role_type,
      seniorityLevel: row.seniority_level,
      score: row.score,
      keyReasons: row.key_reasons ? JSON.parse(row.key_reasons) : [],
      recommendation: row.recommendation,
      optimizedResume: row.optimized_resume,
      coverLetter: row.cover_letter,
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Get analysis history detail error:', error);
    res.status(500).json({ error: '获取分析历史详情失败' });
  }
});

app.post('/api/analysis-history', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const {
    id, company, position, jd, resume, extraDocs,
    fitRating, roleType, seniorityLevel, score,
    keyReasons, recommendation, optimizedResume, coverLetter,
  } = req.body;
  try {
    await runQuery(
      'INSERT INTO analysis_history (id, user_phone, company, position, jd, resume, extra_docs, fit_rating, role_type, seniority_level, score, key_reasons, recommendation, optimized_resume, cover_letter, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id || crypto.randomUUID(), userPhone,
        company || '', position || '',
        jd || '', resume || '', extraDocs || '',
        fitRating || '', roleType || '', seniorityLevel || '', score || 0,
        JSON.stringify(keyReasons || []), recommendation || '',
        optimizedResume || '', coverLetter || '',
        Date.now(),
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Save analysis history error:', error);
    res.status(500).json({ error: '保存分析历史失败' });
  }
});

app.delete('/api/analysis-history/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  try {
    await runQuery('DELETE FROM analysis_history WHERE id = ? AND user_phone = ?', [id, userPhone]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete analysis history error:', error);
    res.status(500).json({ error: '删除分析历史失败' });
  }
});

// ========== Interview History Routes ==========

app.get('/api/interview-history', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  try {
    const rows = await getRows<InterviewHistoryRow>(
      'SELECT * FROM interview_history WHERE user_phone = ? ORDER BY created_at DESC',
      [userPhone]
    );
    const items = rows.map((r) => ({
      id: r.id,
      type: r.type,
      jd: r.jd,
      resume: r.resume,
      questions: r.questions ? JSON.parse(r.questions) : [],
      createdAt: r.created_at,
    }));
    res.json(items);
  } catch (error) {
    console.error('Get interview history error:', error);
    res.status(500).json({ error: '获取面试历史失败' });
  }
});

app.get('/api/interview-history/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  try {
    const row = await getRow<InterviewHistoryRow>('SELECT * FROM interview_history WHERE id = ? AND user_phone = ?', [id, userPhone]);
    if (!row) {
      res.status(404).json({ error: '记录不存在' });
      return;
    }
    res.json({
      id: row.id,
      type: row.type,
      jd: row.jd,
      resume: row.resume,
      questions: row.questions ? JSON.parse(row.questions) : [],
      createdAt: row.created_at,
    });
  } catch (error) {
    console.error('Get interview history detail error:', error);
    res.status(500).json({ error: '获取面试历史详情失败' });
  }
});

app.post('/api/interview-history', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id, type, jd, resume, questions } = req.body;
  try {
    await runQuery(
      'INSERT INTO interview_history (id, user_phone, type, jd, resume, questions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id || crypto.randomUUID(), userPhone,
        type || 'technical',
        jd || '', resume || '',
        JSON.stringify(questions || []),
        Date.now(),
      ]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Save interview history error:', error);
    res.status(500).json({ error: '保存面试历史失败' });
  }
});

app.delete('/api/interview-history/:id', authMiddleware, async (req, res) => {
  await ensureDb();
  const userPhone = (req as any).userPhone;
  const { id } = req.params;
  try {
    await runQuery('DELETE FROM interview_history WHERE id = ? AND user_phone = ?', [id, userPhone]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete interview history error:', error);
    res.status(500).json({ error: '删除面试历史失败' });
  }
});

// ========== Chat Completions Proxy (multi-provider) ==========

app.post('/api/chat/completions', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const { baseUrl } = req.body as { baseUrl?: string };

  if (!apiKey) {
    res.status(401).json({
      error: '请在 API 设置中配置你自己的 API Key（X-API-Key 头）。',
    });
    return;
  }

  const targetBaseUrl = baseUrl?.trim() || BASE_URL;
  const targetUrl = targetBaseUrl.endsWith('/')
    ? `${targetBaseUrl}chat/completions`
    : `${targetBaseUrl}/chat/completions`;

  const upstreamBody = { ...req.body };
  delete (upstreamBody as Record<string, unknown>).baseUrl;

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upstream error:', response.status, errorText);
      res.status(response.status).json({
        error: `Upstream error (${response.status})`,
      });
      return;
    }

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') {
        try {
          res.setHeader(key, value);
        } catch {
          // ignore headers that can't be set
        }
      }
    });

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      };
      await pump();
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';
    console.error('Proxy error targeting', targetUrl, ':', errMsg);
    console.error('Proxy error stack:', errStack);
    res.status(502).json({ error: 'Proxy request failed', detail: errMsg, targetUrl });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from dist (only for local production preview, Vercel handles this separately)
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Local development server
if (!process.env.VERCEL && (process.env.NODE_ENV !== 'production' || import.meta.url === `file://${process.argv[1]}`)) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Mode: BYOK — clients must supply X-API-Key header.`);
  });
}

export default app;
