// Synthetic upstream for customer SSR/browser regression. Binds loopback only.
import http from 'node:http';
let attempts = 0;
const config = {
  id: 'default',
  ratingType: 'ICON+TEXT',
  minimumFeedbackForRanking: 5,
  consentVersion: 'v1',
  ratingOptions: [
    {
      value: 1,
      label: 'Rất không hài lòng',
      english: 'Very unhappy',
      icon: 'smiley-sad',
      enabled: true,
    },
    { value: 2, label: 'Không hài lòng', english: 'Unhappy', icon: 'smiley-sad', enabled: true },
    { value: 3, label: 'Bình thường', english: 'Neutral', icon: 'smiley-meh', enabled: true },
    { value: 4, label: 'Hài lòng', english: 'Happy', icon: 'smiley', enabled: true },
    { value: 5, label: 'Rất hài lòng', english: 'Delighted', icon: 'smiley', enabled: true },
  ],
  reasons: [
    {
      id: 'friendly',
      code: 'FRIENDLY',
      label: 'Thân thiện',
      english: 'Friendly',
      type: 'POSITIVE',
      ratings: [4, 5],
      required: false,
      status: 'ACTIVE',
      order: 1,
    },
    {
      id: 'legacy',
      code: 'LEGACY',
      label: 'Lý do cũ',
      english: '',
      type: 'POSITIVE',
      ratings: [4, 5],
      required: false,
      status: 'ACTIVE',
      order: 2,
    },
  ],
};
http
  .createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    const send = (status, body) => {
      res.statusCode = status;
      res.end(JSON.stringify(body));
    };
    if (req.url === '/healthz') return send(200, { ok: true });
    if (req.url === '/__test/reset') {
      attempts = 0;
      return send(200, { ok: true });
    }
    if (req.url === '/api/v1/public/feedback-config') return send(200, config);
    if (req.url === '/api/v1/public/feedback/demo')
      return send(200, { serverTime: '2026-09-07T01:00:00Z' });
    if (req.url === '/api/v1/public/feedback' && req.method === 'POST') {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      if (body.comment === 'retry-test' && attempts++ === 0)
        return send(503, { error: 'internal detail must not reach the UI', code: 'UNAVAILABLE' });
      return send(201, { createdAt: '2026-09-07T01:01:00Z' });
    }
    return send(404, { code: 'NOT_FOUND', error: 'Unavailable' });
  })
  .listen(4302, '127.0.0.1');
