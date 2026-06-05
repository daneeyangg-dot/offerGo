import app from '../server/index.js';

export default function handler(req: any, res: any) {
  const start = Date.now();
  const timeout = setTimeout(() => {
    res.status(500).json({ error: 'app() timed out after 8s', elapsed: Date.now() - start });
  }, 8000);

  app(req, res);

  // If response is sent, clear timeout
  res.on('finish', () => {
    clearTimeout(timeout);
  });
  res.on('close', () => {
    clearTimeout(timeout);
  });
}
