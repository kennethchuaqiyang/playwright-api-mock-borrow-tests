import { test, expect } from '@playwright/test';

// These tests run against the live deployed service:
// https://mock-borrow-api.onrender.com
//
// Note: the service is hosted on Render's free tier, which spins down after
// inactivity. The first request in a run may take 20-30s to respond while it
// wakes up — the generous timeout/retry settings in playwright.config.ts
// account for this.

const HEADERS = {
  'X-Browser-Type': 'Chrome',
  'X-Admin-Flag': 'false',
};

test.describe('GET /api/user', () => {
  test('happy path: returns correct metadata and cache for a known user', async ({ request }) => {
    const response = await request.get('/api/user', {
      params: { username: 'john', location: 'Singapore', userid: '1' },
      headers: { ...HEADERS, 'X-Admin-Flag': 'true' },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.metadata.username).toBe('john');
    expect(body.metadata.location).toBe('Singapore');
    expect(body.metadata.salary).toBe(5000);

    expect(body.cache.username).toBe('john');
    expect(body.cache.user_identity).toBe(1);
    expect(body.cache.salary).toBe(5000);
  });

  test('response headers: X-Browser echoes request header, X-Secret-Key is present', async ({ request }) => {
    const response = await request.get('/api/user', {
      params: { username: 'john', location: 'Singapore', userid: '1' },
      headers: HEADERS,
    });

    expect(response.status()).toBe(200);
    expect(response.headers()['x-browser']).toBe('Chrome');

    const secretKey = response.headers()['x-secret-key'];
    expect(secretKey).toBeTruthy();
    // SHA-256 hex digest is always 64 characters
    expect(secretKey).toMatch(/^[a-f0-9]{64}$/);
  });

  test('missing required params: returns 400', async ({ request }) => {
    const response = await request.get('/api/user', {
      params: { location: 'Singapore' }, // username and userid deliberately omitted
      headers: HEADERS,
    });

    expect(response.status()).toBe(400);
  });

  test('non-integer userid: returns 400', async ({ request }) => {
    const response = await request.get('/api/user', {
      params: { username: 'john', location: 'Singapore', userid: 'not-a-number' },
      headers: HEADERS,
    });

    expect(response.status()).toBe(400);
  });

  test('wrong method: POST on /api/user returns 405', async ({ request }) => {
    const response = await request.post('/api/user', { headers: HEADERS });
    expect(response.status()).toBe(405);
  });
});

test.describe('POST /api/borrow', () => {
  // Each test uses a fresh, randomized userid so tests don't interfere with
  // each other's balances when run in parallel against the shared live database.
  const freshUserId = () => Math.floor(100000 + Math.random() * 900000);

  test('happy path: borrow within limit is allowed and updates amount_owed', async ({ request }) => {
    const userId = freshUserId();

    const response = await request.post('/api/borrow', {
      headers: HEADERS,
      data: {
        username: 'testuser',
        location: 'Singapore',
        userid: userId,
        amount_to_borrow: 50,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.metadata.amount_owed).toBe(50);
    expect(body.metadata.amount_altered_to_borrow).toBe(50);
    expect(body.metadata.allowed_to_borrow).toBe(true);
  });

  test('over limit: borrow rejected, amount_owed unchanged', async ({ request }) => {
    const userId = freshUserId();

    // First borrow: pushes the user to 150, still within limit.
    await request.post('/api/borrow', {
      headers: HEADERS,
      data: { username: 'testuser', location: 'Singapore', userid: userId, amount_to_borrow: 150 },
    });

    // Second borrow: 150 + 100 = 250, exceeds the 200 limit.
    const response = await request.post('/api/borrow', {
      headers: HEADERS,
      data: { username: 'testuser', location: 'Singapore', userid: userId, amount_to_borrow: 100 },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.metadata.allowed_to_borrow).toBe(false);
    expect(body.metadata.amount_altered_to_borrow).toBe(0);
    expect(body.metadata.amount_owed).toBe(150); // unchanged from the first borrow
  });

  test('exactly at limit (200): still allowed, since only "above" 200 is rejected', async ({ request }) => {
    const userId = freshUserId();

    const response = await request.post('/api/borrow', {
      headers: HEADERS,
      data: { username: 'testuser', location: 'Singapore', userid: userId, amount_to_borrow: 200 },
    });

    const body = await response.json();
    expect(body.metadata.allowed_to_borrow).toBe(true);
    expect(body.metadata.amount_owed).toBe(200);
  });

  test('missing username: returns 400', async ({ request }) => {
    const response = await request.post('/api/borrow', {
      headers: HEADERS,
      data: { location: 'Singapore', userid: freshUserId(), amount_to_borrow: 50 },
    });

    expect(response.status()).toBe(400);
  });

  test('invalid JSON body: returns 400', async ({ request }) => {
    const response = await request.post('/api/borrow', {
      headers: { ...HEADERS, 'Content-Type': 'application/json' },
      data: '{not valid json',
    });

    expect(response.status()).toBe(400);
  });

  test('wrong method: GET on /api/borrow returns 405', async ({ request }) => {
    const response = await request.get('/api/borrow', { headers: HEADERS });
    expect(response.status()).toBe(405);
  });

  test('response headers: X-Browser echoes request header, X-Secret-Key is present', async ({ request }) => {
    const response = await request.post('/api/borrow', {
      headers: { ...HEADERS, 'X-Browser-Type': 'Firefox' },
      data: { username: 'testuser', location: 'Singapore', userid: freshUserId(), amount_to_borrow: 10 },
    });

    expect(response.headers()['x-browser']).toBe('Firefox');
    expect(response.headers()['x-secret-key']).toMatch(/^[a-f0-9]{64}$/);
  });
});