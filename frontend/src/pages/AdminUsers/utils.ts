/**
 * Build query params for the users API call.
 */
export function buildUserParams(
  page: number,
  rowsPerPage: number,
  search: string,
  roleFilter: string,
  tierFilter: string
) {
  return {
    page: page + 1,
    limit: rowsPerPage,
    ...(search && { search }),
    ...(roleFilter && { role: roleFilter }),
    ...(tierFilter && { tier: tierFilter }),
  };
}
