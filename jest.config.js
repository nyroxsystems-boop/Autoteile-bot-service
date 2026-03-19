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
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  // Don't run integration tests by default
  testPathIgnorePatterns: [
    '/node_modules/',
    'integration',
    'e2e',
    '_deprecated',
  ],
};
