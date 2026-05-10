export type Changefreq = 'always' | 'daily' | 'hourly' | 'monthly' | 'never' | 'weekly' | 'yearly';

/* eslint-disable perfectionist/sort-object-types */
export type ParamValue = {
  values: string[];
  lastmod?: string;
  priority?: Priority;
  changefreq?: Changefreq;
};

/* eslint-disable perfectionist/sort-object-types */
export type ParamValues = Record<string, ParamValue[] | never | string[] | string[][]>;

export type Priority = 0.0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | 0.7 | 0.8 | 0.9 | 1.0;

export type LangConfig = {
  default: string;
  alternates: string[];
};

export type Alternate = {
  lang: string;
  path: string;
};

export type PathObj = {
  path: string;
  lastmod?: string; // ISO 8601 datetime
  changefreq?: Changefreq;
  priority?: Priority;
  alternates?: Alternate[];
};

/* eslint-disable perfectionist/sort-object-types */
export type SitemapConfig = {
  additionalPaths?: string[];
  excludeRoutePatterns?: string[];
  headers?: Record<string, string>;
  lang?: LangConfig;
  maxPerPage?: number;
  origin: string;
  page?: string;

  /**
   * Parameter values for dynamic routes, where the values can be:
   * - `string[]`
   * - `string[][]`
   * - `ParamValueObj[]`
   */
  paramValues?: ParamValues;

  /**
   * Optional. Default changefreq, when not specified within a route's `paramValues` objects.
   * Omitting from sitemap config will omit changefreq from all sitemap entries except
   * those where you set `changefreq` property with a route's `paramValues` objects.
   */
  defaultChangefreq?: Changefreq;

  /**
   * Optional. Default priority, when not specified within a route's `paramValues` objects.
   * Omitting from sitemap config will omit priority from all sitemap entries except
   * those where you set `priority` property with a route's `paramValues` objects.
   */
  defaultPriority?: Priority;

  processPaths?: (paths: PathObj[]) => PathObj[];
  sort?: 'alpha' | false;
};
