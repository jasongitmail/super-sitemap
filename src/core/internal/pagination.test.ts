import { describe, expect, it } from 'vitest';

import { paginatePaths } from './pagination.js';

describe('core pagination helpers', () => {
  it('paginates path arrays and reports invalid or unavailable pages', () => {
    const paths = [{ path: '/one' }, { path: '/two' }, { path: '/three' }];

    expect(paginatePaths({ maxPerPage: 2, page: '2', paths })).toEqual({
      kind: 'ok',
      paths: [{ path: '/three' }],
    });
    expect(paginatePaths({ maxPerPage: 2, page: '0', paths })).toEqual({
      kind: 'invalid-page',
    });
    expect(paginatePaths({ maxPerPage: 2, page: '3', paths })).toEqual({
      kind: 'not-found',
    });
  });
});
