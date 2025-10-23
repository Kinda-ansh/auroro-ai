//libs
import httpStatus from 'http-status';

//utilities
import createResponse from '../../../utils/response.js';
import { extractCommonQueryParams } from '../../../utils/requestHelper.js';

//models
import Project from './project.model.js';

//validators
import {
    createProjectValidation,
    updateProjectValidation,
    getProjectValidation,
    deleteProjectValidation,
    listProjectsValidation
} from './project.validator.js';

/**
 * Create a new project
 */
const createProject = async (req, res) => {
    try {
        const payload = req.body;
        const userId = req.user._id;

        await createProjectValidation.validate(payload, { abortEarly: false });

        const project = new Project({
            ...payload,
            userId,
            createdBy: userId,
            settings: {
                temperature: payload.settings?.temperature || 0.7,
                maxTokens: payload.settings?.maxTokens || 2000,
                enabledModels: payload.settings?.enabledModels || ['gemini', 'openai', 'deepseek', 'microsoft', 'llama']
            }
        });

        await project.save();

        return createResponse({
            res,
            statusCode: httpStatus.CREATED,
            status: true,
            message: 'Project created successfully',
            data: { project }
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                message: error.errors?.[0] || 'Validation error',
                status: false,
                error: error.errors
            });
        }
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to create project',
            status: false,
            error: error.message
        });
    }
};

/**
 * Get all projects for authenticated user
 */
const listProjects = async (req, res) => {
    try {
        const userId = req.user._id;
        const { limit, skip, search } = extractCommonQueryParams(req);
        const { isArchived } = req.query;

        await listProjectsValidation.validate({
            ...req.query,
            page: Math.floor(skip / limit) + 1,
            limit
        });

        let query = { userId };

        if (typeof isArchived !== 'undefined') {
            query.isArchived = isArchived === 'true';
        }

        if (search) {
            query.$text = { $search: search };
        }

        const [projects, totalCount] = await Promise.all([
            Project.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-__v'),
            Project.countDocuments(query)
        ]);

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Projects retrieved successfully',
            data: {
                projects,
                count: totalCount,
                page: Math.floor(skip / limit) + 1,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                message: error.errors?.[0] || 'Validation error',
                status: false,
                error: error.errors
            });
        }
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to retrieve projects',
            status: false,
            error: error.message
        });
    }
};

/**
 * Get single project by ID
 */
const getProject = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        await getProjectValidation.validate({ id });

        const project = await Project.findOne({
            _id: id,
            userId
        }).select('-__v');

        if (!project) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'Project not found'
            });
        }

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Project retrieved successfully',
            data: { project }
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                message: error.errors?.[0] || 'Validation error',
                status: false,
                error: error.errors
            });
        }
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to retrieve project',
            status: false,
            error: error.message
        });
    }
};

/**
 * Update project
 */
const updateProject = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const updateData = req.body;

        await updateProjectValidation.validate({ id, ...updateData });

        const project = await Project.findOne({ _id: id, userId });

        if (!project) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'Project not found'
            });
        }

        // Update fields
        if (updateData.name) project.name = updateData.name;
        if (updateData.description !== undefined) project.description = updateData.description;
        if (updateData.settings) project.settings = { ...project.settings, ...updateData.settings };
        if (updateData.isArchived !== undefined) project.isArchived = updateData.isArchived;

        project.updatedBy = userId;
        await project.save();

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Project updated successfully',
            data: { project }
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                message: error.errors?.[0] || 'Validation error',
                status: false,
                error: error.errors
            });
        }
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to update project',
            status: false,
            error: error.message
        });
    }
};

/**
 * Delete project
 */
const deleteProject = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        await deleteProjectValidation.validate({ id });

        const project = await Project.findOneAndDelete({
            _id: id,
            userId
        });

        if (!project) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'Project not found'
            });
        }

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Project deleted successfully'
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                message: error.errors?.[0] || 'Validation error',
                status: false,
                error: error.errors
            });
        }
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to delete project',
            status: false,
            error: error.message
        });
    }
};

export const projectController = {
    createProject,
    listProjects,
    getProject,
    updateProject,
    deleteProject
};
