export default async function handler(_req: any, res: any) {
  const start = Date.now();
  try {
    const mod = await import('../server/index.js');
    const elapsed = Date.now() - start;
    res.json({
      ok: true,
      importMs: elapsed,
      hasApp: !!mod.default,
      vercel: process.env.VERCEL,
      nodeEnv: process.env.NODE_ENV,
      importMetaUrl: import.meta.url,
      argv1: process.argv[1],
      willListen: !process.env.VERCEL && (process.env.NODE_ENV !== 'production' || import.meta.url === `file://${process.argv[1]}`),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
}
