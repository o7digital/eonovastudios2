import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/olivia.mjs';

const request = (body, headers = {}, method = 'POST') => ({ method, headers: { origin: 'https://eon2.vercel.app', 'content-type': 'application/json', ...headers }, body, socket: { remoteAddress: '127.0.0.1' } });
const response = () => ({ status(code) { this.code = code; return this; }, setHeader() { return this; }, json(body) { this.body = body; return this; } });
const valid = { message: '¿Qué servicios ofrece el estudio?', language: 'en', consent: true };

test('Olivia rejects foreign origins, missing consent and invalid input before calling VPS', async () => {
  for (const [req, status] of [
    [request(valid, {}, 'GET'), 405],
    [request(valid, { origin: 'https://other.example' }), 403],
    [request(valid, { 'content-type': 'text/plain' }), 415],
    [request({ ...valid, consent: false }), 400],
    [request({ ...valid, message: 'a'.repeat(2001) }), 400],
    [request({ ...valid, language: 'invalid' }), 400],
    [request('{invalid'), 400],
  ]) {
    const res = response(); await handler(req, res); assert.equal(res.code, status);
  }
});

test('Olivia keeps gateway credentials server-side and propagates signed conversation and rate limits', async () => {
  const saved = globalThis.fetch, key = process.env.OLIVIA_GATEWAY_KEY;
  process.env.OLIVIA_GATEWAY_KEY = 'private-test-key';
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'https://olivia.o7digitalgroup.com/eon2/chat');
      assert.equal(options.headers.Authorization, 'Bearer private-test-key');
      assert.deepEqual(JSON.parse(options.body), { message: '¿Qué servicios ofrece el estudio?', language: 'en', conversation: 'signed' });
      return Response.json({ answer: 'Diseño digital y animación', conversation: 'new-signed', internal: 'private' });
    };
    const res = response(); await handler(request({ ...valid, conversation: 'signed' }), res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.body, { answer: 'Diseño digital y animación', conversation: 'new-signed' });
    globalThis.fetch = async () => new Response('', { status: 429 });
    const limited = response(); await handler(request(valid), limited); assert.equal(limited.code, 429);
  } finally {
    globalThis.fetch = saved;
    if (key === undefined) delete process.env.OLIVIA_GATEWAY_KEY; else process.env.OLIVIA_GATEWAY_KEY = key;
  }
});
