import { describe, expect, it } from 'vitest';

import { validateExcludeRoutePatterns } from './route-exclusion.js';

describe('core route exclusion helpers', () => {
  describe('validateExcludeRoutePatterns', () => {
    it('allows arrays of RegExp values', () => {
      expect(() => validateExcludeRoutePatterns([/^\/dashboard/, /\/admin\//g])).not.toThrow();
    });

    it('throws a helpful error when the config value is not an array', () => {
      const testCases = [
        { expected: 'undefined', value: undefined },
        { expected: 'null', value: null },
        { expected: 'string', value: '/dashboard' },
        { expected: 'object', value: { pattern: '/dashboard' } },
      ];

      for (const { expected, value } of testCases) {
        expect(() => validateExcludeRoutePatterns(value)).toThrow(
          `super-sitemap: \`excludeRoutePatterns\` must be an array of RegExp values. Received ${expected}.`
        );
      }
    });

    it('throws regex literal guidance when an array entry is a string', () => {
      expect(() => validateExcludeRoutePatterns([/\/admin/, '/dashboard'])).toThrow(
        'super-sitemap: `excludeRoutePatterns[1]` must be a RegExp, not a string. Use a regex literal like /dashboard/ instead of "/dashboard".'
      );
    });

    it('throws a helpful error when an array entry is another invalid type', () => {
      const testCases = [
        { expected: 'number', value: 1 },
        { expected: 'boolean', value: false },
        { expected: 'null', value: null },
        { expected: 'object', value: { source: '/dashboard' } },
      ];

      for (const { expected, value } of testCases) {
        expect(() => validateExcludeRoutePatterns([/\/admin/, value])).toThrow(
          `super-sitemap: \`excludeRoutePatterns[1]\` must be a RegExp. Received ${expected}.`
        );
      }
    });
  });
});
