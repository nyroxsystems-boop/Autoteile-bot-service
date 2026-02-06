module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/src/test_legacy/'],
  verbose: true,

  // Path mappings matching tsconfig.json
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

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/test_legacy/**',
    '!src/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
};
