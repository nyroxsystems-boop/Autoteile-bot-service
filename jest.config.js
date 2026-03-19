/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleNameMapper: {
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@adapters/(.*)$': '<rootDir>/src/services/adapters/$1',
    '^@core/(.*)$': '<rootDir>/src/services/core/$1',
    '^@intelligence/(.*)$': '<rootDir>/src/services/intelligence/$1',
    '^@scraping/(.*)$': '<rootDir>/src/services/scraping/$1',
    '^@communication/(.*)$': '<rootDir>/src/services/communication/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@prompts/(.*)$': '<rootDir>/src/prompts/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // Prevent OOM crashes in CI
  maxWorkers: 2,
  workerIdleMemoryLimit: '512MB',
  // Ignore legacy/broken tests and integration suites
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/src/test_legacy/',
    'integration',
    'e2e',
    '_deprecated',
    '\\.spec\\.',
    'e2e_full_flow',
    'ocr_upsert_fallback',
    'integration_oem_scrape',
    'langchain\\.test',
    'conversationIntelligence\\.test',
    'apexPipeline\\.test',
    'botHandlers\\.test',
  ],
  verbose: true,
};
