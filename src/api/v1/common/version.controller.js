import httpStatus from 'http-status';
import createResponse from '../../../utils/response';
import Version from './version.model';
import { getIdFromParams } from '../../../utils/requestHelper';
import mongoose from 'mongoose';

const versionName = '1.1.2';


const matchVersion = async (req, res) => {
    try {
        const { version } = req.body;

        // Validate version input
        if (!version || version.trim() === '') {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Version is required',
            });
        }

        // Check if version exists in DB (regardless of vStatus)
        const existingVersion = await Version.findOne({ version });

        if (!existingVersion) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Version mismatch',
            });
        }

        // Match found
        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Version matched successfully',
        });
    } catch (error) {
        console.error('Error matching version:', error);
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            status: false,
            message: 'Failed to match version',
        });
    }
};

const getVersion = async (req, res) => {
    try {
        const version = await Version.findOne().sort({ createdAt: -1 });

        if (!version) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'No version found',
            });
        }

        // Updated response format
        return res.status(httpStatus.OK).json({
            code: httpStatus.OK,
            status: true,
            message: 'Version fetched successfully',
            data: {
                version: version.version,
                vStatus: version.vStatus,
                extraData: version.extraData
            },
        });
    } catch (error) {
        console.error('Error fetching version:', error);
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            status: false,
            message: 'Failed to fetch version',
        });
    }
};

const createVersion = async (req, res) => {
    try {
        const { version } = req.body;

        // 1. Validate input
        if (!version || version.trim() === '') {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Version is required',
            });
        }

        // 2. Check if version already exists
        const existingVersion = await Version.findOne({ version });

        if (existingVersion) {
            return createResponse({
                res,
                statusCode: httpStatus.CONFLICT,
                status: false,
                message: 'Version already exists',
            });
        }

        // 3. Create new version with vStatus: false
        const newVersion = await Version.create({ version, vStatus: false });

        return createResponse({
            res,
            statusCode: httpStatus.CREATED,
            status: true,
            message: 'Version created successfully',
            data: newVersion,
        });
    } catch (error) {
        console.error('Error creating version:', error);
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            status: false,
            message: 'Failed to create version',
        });
    }
};


const updateVersion = async (req, res) => {
    try {
        const { version, vStatus = false, extraData = {} } = req.body;

        // Validate version
        if (!version || version.trim() === '') {
            return res.status(httpStatus.BAD_REQUEST).json({
                code: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Version is required',
            });
        }

        //====> Find the latest version record as perdicussion By Vishwas Sir
        const existingVersion = await Version.findOne().sort({ createdAt: -1 });

        if (!existingVersion) {
            return res.status(httpStatus.NOT_FOUND).json({
                code: httpStatus.NOT_FOUND,
                status: false,
                message: 'No version found to update',
            });
        }

        // Update values
        existingVersion.version = version;
        existingVersion.vStatus = vStatus;

        // Update extraData fields if provided
        if (extraData.LabelName !== undefined) {
            existingVersion.extraData.LabelName = extraData.LabelName;
        }
        if (extraData.Url !== undefined) {
            existingVersion.extraData.Url = extraData.Url;
        }

        await existingVersion.save();

        // Corrected response format
        return res.status(httpStatus.OK).json({
            code: httpStatus.OK,
            status: true,
            message: 'Version updated successfully',
            data: {
                version: existingVersion.version,
                vStatus: existingVersion.vStatus,
                extraData: existingVersion.extraData
            },
        });
    } catch (error) {
        console.error('Error updating version:', error);
        return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            code: httpStatus.INTERNAL_SERVER_ERROR,
            status: false,
            message: 'Failed to update version',
        });
    }
};



const version = async (req, res) => {
    try {
        const version = versionName;

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Version matched successfully',
            data: {
                version
            }
        });
    } catch (error) {
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            status: false,
            message: 'Failed to match version'
        });
    }
};


const getVersionsByID = async (req, res) => {
    try {
        const id = getIdFromParams(req);

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Invalid or missing version ID',
            });
        }

        // Find version by ID
        const version = await Version.findById(id);

        if (!version) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'Version not found',
            });
        }

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Version fetched successfully',
            data: version,
        });
    } catch (error) {
        console.error('Error fetching version by ID:', error);
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            status: false,
            message: 'Failed to fetch version',
        });
    }
};

module.exports = {
    VersionController: {
        matchVersion,
        version,
        updateVersion,
        getVersion,
        createVersion,
        getVersionsByID
    }
};