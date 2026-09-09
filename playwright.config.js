import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js', timeout: 120000, workers: 1,
  expect: { timeout: 20000 },
  use: { baseURL: 'http://127.0.0.1:5182', viewport: { width: 1440, height: 960 }, launchOptions: { args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:5182', reuseExistingServer: true, timeout: 60000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]]
});
