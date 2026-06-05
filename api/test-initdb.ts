import { initDb } from '../server/db.js';

export default async function handler(_req: any, res: any) {
  try {
    const t1 = Date.now();
    await initDb();
    const t2 = Date.now();
    res.json({ ok: true, initMs: t2 - t1 });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
