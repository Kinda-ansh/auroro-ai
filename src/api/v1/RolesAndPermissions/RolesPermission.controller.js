import httpStatus from '../../../utils/httpStatus';
import createResponse from '../../../utils/response';
import {
  extractCommonQueryParams,
  getIdFromParams,
  getDataFromParams,
  getUserIdFromRequest,
} from '../../../utils/requestHelper';
import Role from './Roles.model';
import { createRoleSchema, updateRoleSchema } from './RolesPermission.validator';
import { getCommonSearchConditionForMasters } from '../../../utils/commonHelper';
import mongoose from 'mongoose';

const getRoles = async (req, res) => {
  try {
    const { limit = 1000, skip = 0, search } = extractCommonQueryParams(req);
    let matchQuery = {};

    if (search) {
      matchQuery.$or = getCommonSearchConditionForMasters(search);
    }

    const rolesAgg = await Role.aggregate([
      { $match: matchQuery },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'userRole',
          as: 'users',
        },
      },
      {
        $addFields: {
          userCount: { $size: '$users' },
          permissionCount: {
            $sum: {
              $map: {
                input: { $ifNull: ['$permissions', []] },
                as: 'perm',
                in: { $size: { $ifNull: ['$$perm.actions', []] } },
              },
            },
          },
          moduleCount: { $size: { $ifNull: ['$permissions', []] } },
        },
      },

      {
        $project: {
          users: 0, // remove full user array
        },
      },
    ]);

    const totalCount = await Role.countDocuments(matchQuery);

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Roles retrieved',
      data: { list: rolesAgg, count: totalCount },
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Failed to fetch roles',
      status: false,
      error: error.message,
    });
  }
};

const createRole = async (req, res) => {
  try {
    req.body.createdBy = req.user._id;
    req.body.updatedBy = req.user._id;

    const data = await createRoleSchema.validate(req.body, {
      abortEarly: false,
    });

    const role = await Role.create(data);

    return createResponse({
      res,
      statusCode: httpStatus.CREATED,
      status: true,
      message: 'Role created successfully.',
      data: role,
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode:
        error.code === 11000 ? httpStatus.CONFLICT : httpStatus.BAD_REQUEST,
      status: false,
      message:
        error.code === 11000
          ? 'Role with this name or code already exists.'
          : error.message,
      error: error.message,
    });
  }
};

const getRole = async (req, res) => {
  try {
    const id = getIdFromParams(req);
    const role = await Role.findById(id);

    if (!role) {
      return createResponse({
        res,
        statusCode: httpStatus.NOT_FOUND,
        status: false,
        message: 'Role not found',
      });
    }

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Role fetched successfully',
      data: role,
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Failed to fetch role',
      error: error.message,
    });
  }
};

const updateRole = async (req, res) => {
  try {
    const id = getIdFromParams(req);
    req.body.updatedBy = req.user._id;

    const data = await updateRoleSchema.validate(req.body, {
      abortEarly: false,
    });

    const role = await Role.findByIdAndUpdate(
      id,
      { $set: data },
      { new: true }
    );

    if (!role) {
      return createResponse({
        res,
        statusCode: httpStatus.NOT_FOUND,
        status: false,
        message: 'Role not found',
      });
    }

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Role updated successfully.',
      data: role,
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode:
        error.code === 11000 ? httpStatus.CONFLICT : httpStatus.BAD_REQUEST,
      status: false,
      message:
        error.code === 11000
          ? 'Duplicate field value exists.'
          : 'Failed to update role.',
      error: error.message,
    });
  }
};

const getPermissions = async (req, res) => {
  try {
    const { limit = 1000, skip = 0, search } = extractCommonQueryParams(req);
    let matchQuery = { _id: new mongoose.Types.ObjectId(req.params.id) };

    if (search) {
      matchQuery.$or = getCommonSearchConditionForMasters(search);
    }

    const [rolesAgg] = await Role.aggregate([
      { $match: matchQuery },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'userRole',
          as: 'users',
        },
      },
      {
        $addFields: {
          userCount: { $size: '$users' },
          permissionCount: {
            $sum: {
              $map: {
                input: '$permissions',
                as: 'perm',
                in: { $size: '$$perm.actions' },
              },
            },
          },
          moduleCount: { $size: '$permissions' },
        },
      },
      {
        $project: {
          users: 0,
        },
      },
    ]);

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Roles retrieved',
      data: { list: rolesAgg },
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      message: 'Failed to fetch roles',
      status: false,
      error: error.message,
    });
  }
};

export const RoleController = {
  getRoles,
  createRole,
  getRole,
  updateRole,
  getPermissions
};
