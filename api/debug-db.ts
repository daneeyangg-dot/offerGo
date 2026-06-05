export default async function handler(_req: any, res: any) {
  try {
    const start = Date.now();
    const mod = await import('../server/db.js');
    const elapsed = Date.now() - start;
    res.json({ ok: true, importMs: elapsed, hasDb: !!mod.db });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
