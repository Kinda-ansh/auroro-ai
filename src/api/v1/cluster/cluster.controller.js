import httpStatus from '../../../utils/httpStatus';
import createResponse from '../../../utils/response';
import {
    extractCommonQueryParams,
    getIdFromParams,
    getDataFromParams,
    getUserIdFromRequest,
} from '../../../utils/requestHelper';
import { createVillageSchema, updateVillageSchema } from './cluster.validation';
import { getCommonSearchConditionForMasters } from '../../../utils/commonHelper';
import Cluster from './cluster.model';
import Hamlet from '../hamlet/hamlet.model';
import Batch from '../batch/batch.model';

const filterFieldMap = {
    countryId: 'country',
    stateId: 'state',
    districtId: 'district',
    tehsilId: 'tehsil',
    villageId: 'village',
};

const getClusters = async (req, res) => {
    try {
        const { limit = 1000, skip = 0, search, isActive } = extractCommonQueryParams(req);
        let query = req.queryFields || {};
        query.deletedAt = null;

        if (isActive === 'true' || isActive === true) {
            query.isActive = true;
        } else if (isActive === 'false' || isActive === false) {
            query.isActive = false;
        }

        const andConditions = [];

        if (search) {
            const searchConditions = getCommonSearchConditionForMasters(search);
            if (searchConditions.length) {
                andConditions.push({ $or: searchConditions });
            }
        }

        // Apply filters (each filter is its own AND condition)
        const pushFilter = (queryKey) => {
            const values = req.query[queryKey]?.split(',').filter(Boolean);
            const dbField = filterFieldMap[queryKey];
            if (values?.length && dbField) {
                andConditions.push({ [dbField]: { $in: values } });
            }
        };

        Object.keys(filterFieldMap).forEach(pushFilter);

        if (andConditions.length) {
            query.$and = andConditions;
        }

        const [list, totalCount] = await Promise.all([
            Cluster.find(query)
                .sort({ code: -1 })
                .skip(skip)
                .limit(limit)
                .populate([
                 
                    { path: 'state', select: 'name _id' },
                    { path: 'district', select: 'name _id' },
                    { path: 'tehsil', select: 'name _id' },
                    { path: 'village', select: 'name _id' },
                ]),
            Cluster.countDocuments(query),
        ]);

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Clusters retrieved',
            data: { list: list, count: totalCount },
        });
    } catch (error) {
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to fetch villages',
            status: false,
            error: error.message,
        });
    }
};

const createCluster = async (req, res) => {
    try {
        req.body.createdBy = req.user._id;
        req.body.updatedBy = req.user._id;

        const data = await createVillageSchema.validate(req.body, {
            abortEarly: false,
        });

        const cluster = await Cluster.create(data);

        return createResponse({
            res,
            statusCode: httpStatus.CREATED,
            status: true,
            message: 'Cluster created successfully.',
            data: cluster,
        });
    } catch (error) {
        return createResponse({
            res,
            statusCode:
                error.code === 11000 ? httpStatus.CONFLICT : httpStatus.BAD_REQUEST,
            status: false,
            message:
                error.code === 11000
                    ? 'Village with this name or code already exists.'
                    : error.message,
            error: error.message,
        });
    }
};

const getCluster = async (req, res) => {
    try {
        const id = getIdFromParams(req);
        const cluster = await Cluster.findOne({
            _id: id,
            deletedAt: null,
        }).populate([
         
            { path: 'state', select: 'name _id' },
            { path: 'district', select: 'name _id' },
            { path: 'tehsil', select: 'name _id' },
            { path: 'village', select: 'name _id' },
        ]);

        if (!cluster) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'cluster not found',
            });
        }

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'cluster fetched successfully',
            data: cluster,
        });
    } catch (error) {
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            status: false,
            message: 'Failed to fetch cluster',
            error: error.message,
        });
    }
};

const updateCluster = async (req, res) => {
  try {
    const id = getIdFromParams(req);
    req.body.updatedBy = req.user._id;

    const data = await updateVillageSchema.validate(req.body, {
      abortEarly: false,
    });

    // Fetch the cluster before updating to get the old villages
    const cluster = await Cluster.findById(id);
    if (!cluster) {
      return createResponse({
        res,
        statusCode: httpStatus.NOT_FOUND,
        status: false,
        message: 'Cluster not found',
      });
    }
    const oldVillages = cluster.village || [];

    // Update the cluster
    const updatedCluster = await Cluster.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: data },
      { new: true }
    );

    if (!updatedCluster) {
      return createResponse({
        res,
        statusCode: httpStatus.NOT_FOUND,
        status: false,
        message: 'Cluster not found',
      });
    }

    const newVillages = updatedCluster.village || [];

    // Determine added and removed villages
    const addedVillages = newVillages.filter(v => !oldVillages.some(ov => ov.toString() === v.toString()));
    const removedVillages = oldVillages.filter(v => !newVillages.some(nv => nv.toString() === v.toString()));

    // If there are changes, update batches
    if (addedVillages.length > 0 || removedVillages.length > 0) {
      // Calculate agendas for added villages
      const majre = await Hamlet.find({ village: { $in: addedVillages } }, { _id: 1, village: 1, name: 1 }).lean();
      const addedAgendas = addedVillages.map(village => {
        const villageMajre = majre.filter(majra => majra.village.toString() === village.toString());
        return {
          village: village,
          agenda: villageMajre.map((hamlet, index) => ({
            hamlet: hamlet._id,
            title: `मज़रा/पुरवा दिवस ${index + 5} - ${hamlet.name?.english} ${hamlet.name?.hindi ? "(" + hamlet.name?.hindi + ")" : ""}`,
            tasks: ["प्रभावशाली व्यक्ति के साथ मजरे/पुरवे का भ्रमण"],
            forms: ["66517eecf0b48e4b6c6c28ac"],
          })),
        };
      });

      await Batch.updateMany(
        { cluster: id, deletedAt: null },
        {
          $pull: { villageAgenda: { village: { $in: [...removedVillages, ...addedVillages] } } },
        }
      );

      if (addedAgendas.length > 0) {
        await Batch.updateMany(
          { cluster: id, deletedAt: null },
          {
            $push: { villageAgenda: { $each: addedAgendas } },
          }
        );
      }
    }

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'Cluster updated successfully.',
      data: updatedCluster,
    });
  } catch (error) {
    return createResponse({
      res,
      statusCode: error.code === 11000 ? httpStatus.CONFLICT : httpStatus.BAD_REQUEST,
      status: false,
      message: error.code === 11000 ? 'Duplicate field value exists.' : 'Failed to update cluster.',
      error: error.message,
    });
  }
};

const deleteCluster = async (req, res) => {
    try {
        const id = getIdFromParams(req);
        if (!id) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'ID not provided',
            });
        }
        const updatedBy = getUserIdFromRequest(req);
        const cluster = await Cluster.findOne({ _id: id, deletedAt: null });
        if (!cluster) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'cluster not found',
            });
        }
        await cluster.softDelete(updatedBy);

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'cluster deleted successfully',
        });
    } catch (error) {
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            status: false,
            message: 'Failed to delete cluster',
            error: error.message,
        });
    }
};



export const ClusterController = {
    getClusters,
    createCluster,
    deleteCluster,
    updateVillage: updateCluster,
    getCluster
};
