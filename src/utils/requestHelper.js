export const getIdFromParams = (req) => req.params.id;

export const getUserIdFromRequest = (req) => req.user._id;

export const getUserRoleFromRequest = (req) => req.user.roleId;

export const extractCommonQueryParams = (req) => {
  const pageSize = parseInt(req.query.pageSize) || parseInt(req.query.limit) || 1000;
  const page = parseInt(req.query.page) || 1;

  return {
    limit: pageSize,
    skip: (page - 1) * pageSize,
    search: req.query.search,
    isActive: req.query.isActive
  };
};

export function extractQueryParams(req) {
  const {
    limit = 1000,
    page = 1,
    search,
    sortBy = 'createdAt',
    order = 'desc',
    ...filters
  } = req.query;
  const skip = (page - 1) * limit;
  return {
    limit: parseInt(limit, 10),
    skip: parseInt(skip, 10),
    search,
    sortBy,
    order,
    filters,
  };
}

export const getSourceFromRequest = (req) => req.body.source;

export const getDataFromParams = (req, key) => req.params[key];
export const getDataFromQuery = (req, key) => req.query[key];