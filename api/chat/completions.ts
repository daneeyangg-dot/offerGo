import type { VercelRequest, VercelResponse } from '@vercel/node';

const BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function applyCors(req: VercelRequest, res: VercelResponse): void {
  const origin = req.headers.origin as string | undefined;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    return res.status(401).json({
      error: '请在 API 设置中配置你自己的 DashScope Key（X-API-Key 头）。',
    });
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
      return res.status(response.status).json({
        error: `Upstream error (${response.status})`,
      });
    }

    res.status(response.status);

    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (lowerKey !== 'content-encoding' && lowerKey !== 'transfer-encoding') {
        try {
          res.setHeader(key, value);
        } catch {
          // ignore headers that can't be set
        }
      }
    });

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } else {
      const text = await response.text();
      res.send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error instanceof Error ? error.message : String(error));
    res.status(502).json({ error: 'Proxy request failed' });
  }
}
