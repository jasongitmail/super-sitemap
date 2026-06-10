import type { PathObj } from './types.js';

export type PaginatedPathsResult =
  | {
      error: 'invalid-page';
    }
  | {
      error: 'not-found';
    }
  | {
      error: null;
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
    return { error: 'invalid-page' };
  }

  const pageInt = Number(page);
  if (pageInt > getTotalPages(paths, maxPerPage)) {
    return { error: 'not-found' };
  }

  return {
    error: null,
    paths: paths.slice((pageInt - 1) * maxPerPage, pageInt * maxPerPage),
  };
}
