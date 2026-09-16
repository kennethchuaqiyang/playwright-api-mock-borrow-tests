import { defineConfig } from '@playwright/test';
 
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 1, // free-tier cold starts can cause an occasional slow/failed first request
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'https://mock-borrow-api.onrender.com',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },
  timeout: 30_000, // generous timeout to allow for Render free-tier cold starts
});