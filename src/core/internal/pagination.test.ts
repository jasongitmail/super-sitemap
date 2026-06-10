import { describe, expect, it } from 'vitest';

import { paginatePaths } from './pagination.js';

describe('core pagination helpers', () => {
  it('paginates path arrays and reports invalid or unavailable pages', () => {
    const paths = [{ path: '/one' }, { path: '/two' }, { path: '/three' }];

    expect(paginatePaths({ maxPerPage: 2, page: '2', paths })).toEqual({
      error: null,
      paths: [{ path: '/three' }],
    });
    expect(paginatePaths({ maxPerPage: 2, page: '0', paths })).toEqual({
      error: 'invalid-page',
    });
    expect(paginatePaths({ maxPerPage: 2, page: '3', paths })).toEqual({
      error: 'not-found',
    });
  });
});
