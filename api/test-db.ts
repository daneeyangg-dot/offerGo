import { createClient } from '@libsql/client';

export default async function handler(_req: any, res: any) {
  try {
    const t1 = Date.now();
    const client = createClient({ url: 'file::memory:' });
    const t2 = Date.now();
    await client.batch(['CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY)']);
    const t3 = Date.now();
    res.json({ ok: true, createMs: t2 - t1, batchMs: t3 - t2 });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
