import { initDb } from '../server/db.js';

export default async function handler(_req: any, res: any) {
  try {
    const t1 = Date.now();
    await initDb();
    const t2 = Date.now();
    res.json({ ok: true, initMs: t2 - t1 });
  } catch (err: any) {
    res.status(500).json({
      error: err.message,
      hasTursoUrl: !!process.env.TURSO_DATABASE_URL,
      hasTursoToken: !!process.env.TURSO_AUTH_TOKEN,
      tursoUrlPrefix: process.env.TURSO_DATABASE_URL?.slice(0, 20),
    });
  }
}
