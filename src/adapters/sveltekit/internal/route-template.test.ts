import { describe, expect, it } from 'vitest';

import { findSvelteKitLangToken, parseSvelteKitRouteTemplate } from './route-template.js';

describe('SvelteKit route template parser', () => {
  it('maps locale, matcher, rest, source, and compatibility metadata into normalized templates', () => {
    const optionalLocale = parseSvelteKitRouteTemplate({
      filePath: '/src/routes/(public)/[[lang=lang]]/blog/[slug]/+page.svelte',
      route: '/[[lang=lang]]/blog/[slug]',
    });
    const requiredLocale = parseSvelteKitRouteTemplate({
      route: '/[lang]/campsites/[country]/[state]',
    });
    const matcherParam = parseSvelteKitRouteTemplate({
      route: '/blog/[page=integer]',
    });
    const restParam = parseSvelteKitRouteTemplate({
      route: '/docs/[...rest]',
    });

    expect(optionalLocale).toMatchObject({
      locale: { matcher: 'lang', mode: 'optional', paramName: 'lang', segmentIndex: 0 },
      params: [{ name: 'slug', segmentIndex: 2 }],
      segments: [
        { kind: 'locale', matcher: 'lang', name: 'lang' },
        { kind: 'static', value: 'blog' },
        { kind: 'param', name: 'slug' },
      ],
      source: {
        adapter: 'sveltekit',
        compatibilityKey: '/[[lang=lang]]/blog/[slug]',
        filePath: '/src/routes/(public)/[[lang=lang]]/blog/[slug]/+page.svelte',
      },
    });
    expect(requiredLocale.locale).toEqual({
      mode: 'required',
      paramName: 'lang',
      segmentIndex: 0,
    });
    expect(matcherParam.params).toEqual([
      { matcher: 'integer', name: 'page', rest: false, segmentIndex: 1 },
    ]);
    expect(restParam.params).toEqual([{ name: 'rest', rest: true, segmentIndex: 1 }]);

    for (const template of [optionalLocale, requiredLocale, matcherParam, restParam]) {
      expect(template.segments).not.toContainEqual(
        expect.objectContaining({ value: expect.stringMatching(/\+page|\.svelte|\[\[/) })
      );
      expect(template.segments).not.toContainEqual(
        expect.objectContaining({ name: expect.stringMatching(/\[[^\]]+\]/) })
      );
    }
  });

  it('matches optional and required SvelteKit locale route tokens', () => {
    const regex = findSvelteKitLangToken();

    expect(regex.test('/[[lang]]/about')).toBe(true);
    expect(findSvelteKitLangToken().test('/[lang=lang]/about')).toBe(true);
    expect(findSvelteKitLangToken().test('/blog/[slug]')).toBe(false);
  });
});
