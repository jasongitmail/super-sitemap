import { describe, expect, it } from 'vitest';

import type {
  Alternate,
  Changefreq,
  LangConfig,
  ParamValue,
  ParamValues,
  PathObj,
  Priority,
  SitemapConfig,
} from './index.js';

import { response, sampledPaths, sampledUrls } from './index.js';

describe('public package root API', () => {
  it('should root-export response and sampled utilities', () => {
    expect(response).toBeTypeOf('function');
    expect(sampledPaths).toBeTypeOf('function');
    expect(sampledUrls).toBeTypeOf('function');
  });

  it('should typecheck documented root types without import path changes', () => {
    const paramValue: ParamValue = {
      changefreq: 'daily',
      lastmod: '2025-01-01T00:00:00Z',
      priority: 0.7,
      values: ['usa', 'new-york'],
    };
    const paramValues: ParamValues = {
      '/[[lang]]/blog/[slug]': ['hello-world'],
      '/[[lang]]/campsites/[country]/[state]': [['usa', 'new-york']],
      '/[[lang]]/rankings/[country]/[state]': [paramValue],
    };
    const alternate: Alternate = { lang: 'en', path: '/about' };
    const pathObj: PathObj = {
      alternates: [alternate],
      changefreq: 'weekly',
      path: '/about',
      priority: 0.5,
    };
    const lang: LangConfig = { alternates: ['zh'], default: 'en' };
    const changefreq: Changefreq = 'monthly';
    const priority: Priority = 0.6;
    const config: SitemapConfig = {
      defaultChangefreq: changefreq,
      defaultPriority: priority,
      lang,
      origin: 'https://example.com',
      paramValues,
      processPaths: (paths: PathObj[]) => [...paths, pathObj],
    };

    expect(config.paramValues).toBe(paramValues);
    expect(config.processPaths?.([])).toEqual([pathObj]);
  });
});
