import type { ParamMatcher } from '@sveltejs/kit';

// Returns true if 0 or greater.
export const match: ParamMatcher = (param) => {
  return /^\d+$/.test(param);
};
