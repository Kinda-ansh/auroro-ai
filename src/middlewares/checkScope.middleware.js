import httpStatus from "../utils/httpStatus";
import createResponse from "../utils/response";

const checkScope = (moduleName) => {
    return async (req, res, next) => {
        try {
            const userProfile = req.user.profile || {};
            const scope = req.user.userRole;
            // const modulePermissions = role.permissions.find(p => p.module === moduleName);
            // let scope = ''
            // if (modulePermissions) {
            //     scope = modulePermissions.level || role.level
            // }

            const query = req.queryFields || {};

            if (scope === 'state' && userProfile.state) {
                query.state = userProfile.state;
            } else if (scope === 'district' && userProfile.state) {
                query.state = userProfile.state;
                query.district = userProfile.district;
            } else if (scope === 'tehsil' && userProfile.state) {
                query.state = userProfile.state;
                query.district = userProfile.district || { $exists: true };
                query.tehsil = userProfile.tehsil;
            } else if (scope === 'village' && userProfile.state) {
                query.state = userProfile.state;
                query.district = userProfile.district || { $exists: true };
                query.tehsil = userProfile.tehsil || { $exists: true };
                query.village = userProfile.village;
            }

            req.queryFields = query;
            next();
        } catch (error) {
            return createResponse({
                res,
                statusCode: httpStatus.INTERNAL_SERVER_ERROR,
                status: false,
                message: error.message,
            });
        }
    }
};

export default checkScope;