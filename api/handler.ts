export default function handler(req: any, res: any) {
  res.json({ ok: true, path: req.url, method: req.method });
}
