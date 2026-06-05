export default async function handler(_req: any, res: any) {
  const start = Date.now();
  try {
    const mod = await import('../server/index.js');
    const elapsed = Date.now() - start;
    res.json({ ok: true, importMs: elapsed, hasApp: !!mod.default });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
