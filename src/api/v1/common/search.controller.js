import mongoose from 'mongoose';
const { default: createResponse } = require('../../../utils/response');
import { httpStatus } from '../../../utils/httpStatus.js';
import { extractCommonQueryParams, getDataFromParams } from '../../../utils/requestHelper.js';
import { getCommonFilterConditionForMasters, getCommonSearchConditionForMasters } from '../../../utils/commonHelper.js';

const allowedCollections = new Map([
  ['batch', 'Batch'],
  ['country', 'Country'],
  ['state', 'State'],
  ['district', 'District'],
  ['tehsil', 'Tehsil'],
  ['village', 'Village'],
  ['category', 'ResourceCategory'],
  ['subcategory', 'ResourceSubcategory'],
  ['type', 'ResourceType'],
]);

const search = async (req, res) => {
  const collectionName = getDataFromParams(req, 'collectionName')?.toLowerCase();
  try {
    const modelName = allowedCollections.get(collectionName);

    if (!modelName) {
      return createResponse({
        res,
        statusCode: httpStatus.BAD_REQUEST,
        status: false,
        message: 'Invalid collection name',
      });
    }

    const { limit = 1000, search } = extractCommonQueryParams(req);
    const query = { deletedAt: null, $or: [{ isActive: { $exists: false } }, { isActive: true }] };

    if (search) {
      query.$or = getCommonSearchConditionForMasters(search);
    }

    const filters = getCommonFilterConditionForMasters(req)
    if (filters && filters.length) query.$and = filters

    const Model = mongoose.model(modelName);
    const list = await Model.aggregate([
      { $match: query },
      { $limit: Number(limit) },
      {
        $project: {
          value: '$_id',
          label: {
            $cond: [
              { $eq: [{ $type: '$name' }, 'object'] }, // if name is an object
              {
                $cond: [
                  { $and: [{ $ifNull: ['$name.english', false] }, { $ifNull: ['$name.hindi', false] }] },
                  { $concat: ['$name.english', ' (', '$name.hindi', ')'] },
                  { $ifNull: ['$name.english', '$name.hindi'] },
                ],
              },
              '$name', // if name is not an object, assume it's string
            ],
          },
        },
      },
      { $sort: { label: 1 } },
    ]).exec();


    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Search data sent successfully',
      data: list,
    });
  } catch (error) {
    console.error(error);

    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Failed to search entries',
    });
  }
};

module.exports = {
  SearchController: {
    search,
  },
};