# Playwright API Tests — Mock Borrow API

API automation tests for [mock-borrow-api](https://github.com/kennethchuaqiyang/mock-borrow-api), using Playwright's `request` context (no browser needed — pure HTTP API testing).

**Target:** https://mock-borrow-api.onrender.com (live deployed service)

## Coverage

**GET /api/user**
- Happy path — correct metadata/cache for a known user
- Response headers — `X-Browser` echo, `X-Secret-Key` format
- Missing required params → 400
- Non-integer `userid` → 400
- Wrong method (POST) → 405

**POST /api/borrow**
- Happy path — borrow within limit, `amount_owed` updates correctly
- Over limit — rejected, `amount_owed` unchanged
- Exactly at the 200 limit — still allowed (only "above" 200 is rejected)
- Missing username → 400
- Invalid JSON body → 400
- Wrong method (GET) → 405
- Response headers — `X-Browser` echo, `X-Secret-Key` format

Each borrow test uses a randomized `userid` so tests don't interfere with each other's balances when run in parallel against the shared live database.

## Setup

```bash
npm install
npx playwright install
```

## Running

```bash
npm test
```

Or, for an HTML report:
```bash
npm run test:headed-report
```

## Notes

- The target service runs on Render's free tier, which spins down after inactivity. The first request in a run may take 20-30 seconds while it wakes up — `playwright.config.ts` sets a generous timeout and one retry to account for this.
- Data is stored in a real Postgres database (Neon), so borrow amounts persist across test runs — this is why each test creates a fresh random user rather than reusing a fixed one.