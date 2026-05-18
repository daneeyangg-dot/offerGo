import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(express.json());

// CORS — origin-allowlisted (empty allowlist = no cross-origin access)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Proxy chat completions to DashScope (BYOK — bring your own key)
app.post('/api/chat/completions', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({
      error: '请在 API 设置中配置你自己的 DashScope Key（X-API-Key 头）。',
    });
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('DashScope error:', response.status, errorText);
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
    console.error('Proxy error:', error instanceof Error ? error.message : String(error));
    res.status(502).json({ error: 'Proxy request failed' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Serve static files from dist
const distPath = path.resolve(__dirname, '../dist');
app.use(express.static(distPath));

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Mode: BYOK — clients must supply X-API-Key header.`);
});
