import mongoose from 'mongoose';
import httpStatus, { FORBIDDEN } from 'http-status';
import createResponse from '../utils/response';
import RolesModel from '../api/v1/RolesAndPermissions/Roles.model';
import PermissionModel from '../api/v1/RolesAndPermissions/Permission.model';

const errorMessages = {
  FORBIDDEN: 'Unauthorized user',
};

const checkPermission = (moduleName, action, description) => {
  return async (req, res, next) => {
    try {
      return next();
      const role = req.user.userRole;

      if (!role || !role.permissions) {
        return createResponse({
          res,
          statusCode: httpStatus.FORBIDDEN,
          status: false,
          message: errorMessages.FORBIDDEN,
        });
      }

      const modulePermissions = role.permissions.find(p => p.module === moduleName);
      const hasPermission = modulePermissions && modulePermissions.actions.includes(action);

      if (!modulePermissions) {
        const exists = await PermissionModel.findOne({ module: moduleName, action });
        if (!exists) {
          await PermissionModel.create({ module: moduleName, action, description });
        }
      }

      if (hasPermission) return next();

      return createResponse({
        res,
        statusCode: httpStatus.FORBIDDEN,
        status: false,
        message: errorMessages.FORBIDDEN,
      });
    } catch (error) {
      return createResponse({
        res,
        statusCode: httpStatus.INTERNAL_SERVER_ERROR,
        status: false,
        message: error.message,
      });
    }
  };
};

export default checkPermission;
