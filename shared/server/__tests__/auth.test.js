import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const { proxySecretGuard } = require('../auth');

function createMockReq(overrides = {}) {
  return {
    method: 'GET',
    path: '/api/roster',
    ip: '127.0.0.1',
    headers: {},
    ...overrides
  };
}

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { res.statusCode = code; return res; },
    json(data) { res.body = data; return res; }
  };
  return res;
}

describe('proxySecretGuard', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.PROXY_AUTH_SECRET;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PROXY_AUTH_SECRET;
    } else {
      process.env.PROXY_AUTH_SECRET = originalEnv;
    }
  });

  it('passes through when PROXY_AUTH_SECRET is not set', () => {
    delete process.env.PROXY_AUTH_SECRET;
    const req = createMockReq();
    const res = createMockRes();
    let called = false;
    proxySecretGuard(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('passes through when PROXY_AUTH_SECRET is empty string', () => {
    process.env.PROXY_AUTH_SECRET = '';
    const req = createMockReq();
    const res = createMockRes();
    let called = false;
    proxySecretGuard(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('passes through for OPTIONS requests even with secret set', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret';
    const req = createMockReq({ method: 'OPTIONS' });
    const res = createMockRes();
    let called = false;
    proxySecretGuard(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('passes through for /healthz path', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret';
    const req = createMockReq({ path: '/healthz' });
    const res = createMockRes();
    let called = false;
    proxySecretGuard(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('passes through for /api/healthz path', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret';
    const req = createMockReq({ path: '/api/healthz' });
    const res = createMockRes();
    let called = false;
    proxySecretGuard(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('passes through when valid secret is provided', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret';
    const req = createMockReq({ headers: { 'x-proxy-secret': 'test-secret' } });
    const res = createMockRes();
    let called = false;
    proxySecretGuard(req, res, () => { called = true; });
    expect(called).toBe(true);
  });

  it('returns 401 when secret is missing', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret';
    const req = createMockReq();
    const res = createMockRes();
    let called = false;
    proxySecretGuard(req, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when secret is invalid', () => {
    process.env.PROXY_AUTH_SECRET = 'test-secret';
    const req = createMockReq({ headers: { 'x-proxy-secret': 'wrong-secret' } });
    const res = createMockRes();
    let called = false;
    proxySecretGuard(req, res, () => { called = true; });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
  });
});
