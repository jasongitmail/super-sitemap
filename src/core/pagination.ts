import type { PathObj } from './types.js';

export type PaginatedPathsResult =
  | {
      kind: 'invalid-page';
    }
  | {
      kind: 'not-found';
    }
  | {
      kind: 'ok';
      paths: PathObj[];
    };

export function getTotalPages(paths: PathObj[], maxPerPage: number): number {
  return Math.ceil(paths.length / maxPerPage);
}

export function paginatePaths({
  maxPerPage,
  page,
  paths,
}: {
  maxPerPage: number;
  page: string;
  paths: PathObj[];
}): PaginatedPathsResult {
  if (!/^[1-9]\d*$/.test(page)) {
    return { kind: 'invalid-page' };
  }

  const pageInt = Number(page);
  if (pageInt > getTotalPages(paths, maxPerPage)) {
    return { kind: 'not-found' };
  }

  return {
    kind: 'ok',
    paths: paths.slice((pageInt - 1) * maxPerPage, pageInt * maxPerPage),
  };
}
