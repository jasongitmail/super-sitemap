export { getTotalPages, paginatePaths } from './pagination.js';
export type { PaginatedPathsResult } from './pagination.js';
export { deduplicatePaths, generateAdditionalPaths, sortPaths } from './paths.js';
export { generatePathsFromRouteTemplates } from './route-templates.js';
export type {
  Alternate,
  Changefreq,
  LangConfig,
  ParamValue,
  ParamValues,
  PathObj,
  Priority,
  RouteLocaleSlot,
  RouteParam,
  RouteSegment,
  RouteSource,
  RouteTemplate,
  SitemapConfig,
} from './types.js';
export { renderSitemapIndexXml, renderSitemapXml } from './xml.js';
