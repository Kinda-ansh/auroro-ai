//libs
import httpStatus from 'http-status';

//utilities
import createResponse from '../../../utils/response';
import { extractCommonQueryParams } from '../../../utils/requestHelper';

//models
import AIResponse from './ai.model';

//services
import aiService from '../../../services/ai.service';

//validators
import {
    generateAIResponseValidation,
    getAIResponseValidation,
    listAIResponsesValidation,
    updateModelResponseValidation,
    deleteAIResponseValidation,
    getAIStatsValidation,
    selectPreferredResponseValidation
} from './ai.validator';

/**
 * Generate responses from multiple AI models
 */
const generateAIResponse = async (req, res) => {
    try {
        const payload = req.body;
        const userId = req.user._id;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        // Validate payload
        await generateAIResponseValidation.validate(payload, { abortEarly: false });

        let { prompt, projectId, settings = {} } = payload;

        // Auto-create default project if not provided
        if (!projectId) {
            const Project = (await import('../project/project.model.js')).default;

            // Use first part of prompt as project name (max 50 chars)
            const projectName = prompt.length > 50
                ? prompt.substring(0, 50) + '...'
                : prompt;

            const defaultProject = new Project({
                name: projectName,
                userId,
                createdBy: userId,
                settings: {
                    temperature: 0.7,
                    maxTokens: 2000,
                    enabledModels: ['gemini', 'openai', 'deepseek', 'microsoft', 'llama']
                }
            });
            await defaultProject.save();

            projectId = defaultProject._id;
        }

        // Get enabled models from settings or use defaults
        const enabledModels = settings.enabledModels || ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];
        const availableProviders = aiService.getEnabledProviders();
        const availableModelNames = availableProviders.map(p => p.key);

        // Filter enabled models to only include available ones
        const modelsToUse = enabledModels.filter(model => availableModelNames.includes(model));

        if (modelsToUse.length === 0) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'No AI models are configured and available'
            });
        }

        // Create initial AI response record with pending status for all models
        const aiResponse = new AIResponse({
            prompt,
            userId,
            projectId,
            settings: {
                ...settings,
                enabledModels: modelsToUse
            },
            totalModels: modelsToUse.length,
            overallStatus: 'processing',
            ipAddress,
            userAgent,
            createdBy: userId
        });

        // Initialize all enabled models as pending
        modelsToUse.forEach(model => {
            aiResponse[`${model}_response`] = {
                model,
                status: 'pending',
                response: '',
                createdAt: new Date()
            };
        });

        await aiResponse.save();

        // Return immediately - models will be generated independently
        // Send the response ID back to client for polling
        res.status(httpStatus.CREATED).json({
            status: true,
            message: 'AI response generation initiated',
            data: { aiResponse }
        });

        // Generate responses from all models independently (don't await)
        generateIndependentResponses(aiResponse._id, prompt, modelsToUse, settings);

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
            message: 'Failed to generate AI responses',
            status: false,
            error: error.message
        });
    }
};

/**
 * Generate responses from all models independently (background process)
 */
const generateIndependentResponses = async (responseId, prompt, models, settings) => {
    // Generate each model response independently without waiting for others
    models.forEach(async (model) => {
        try {
            console.log(`[Controller] Starting generation for ${model}`);
            const result = await aiService.generateSingleModelResponse(model, prompt, settings);

            console.log(`[Controller] ${model} generation completed:`, {
                status: result.status,
                hasResponse: !!result.response,
                errorMessage: result.errorMessage || 'none'
            });

            // Update just this model's response
            await AIResponse.findByIdAndUpdate(
                responseId,
                {
                    [`${model}_response`]: {
                        ...result,
                        createdAt: result.createdAt || new Date()
                    },
                    updatedAt: new Date()
                },
                { new: true }
            );
        } catch (error) {
            console.error(`[Controller] Error generating ${model} response:`, error);
            // Update this model's response with error
            await AIResponse.findByIdAndUpdate(
                responseId,
                {
                    [`${model}_response`]: {
                        model,
                        status: 'error',
                        response: '',
                        errorMessage: error.message || 'Failed to generate response',
                        tokens: { prompt: 0, completion: 0, total: 0 },
                        responseTime: 0,
                        createdAt: new Date()
                    },
                    updatedAt: new Date()
                },
                { new: true }
            );
        }
    });
};

/**
 * Get all AI responses for authenticated user
 */
const listAIResponses = async (req, res) => {
    try {
        const userId = req.user._id;
        const { limit, skip, search } = extractCommonQueryParams(req);
        const { status, model, projectId, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        // Validate query parameters
        await listAIResponsesValidation.validate({
            ...req.query,
            page: Math.floor(skip / limit) + 1,
            limit
        });

        let query = { userId };

        // Filter by project
        if (projectId) {
            query.projectId = projectId;
        }

        // Filter by status
        if (status) {
            query.overallStatus = status;
        }

        // Filter by model (check if any model response exists)
        if (model) {
            const modelField = `${model}_response.status`;
            query[modelField] = { $exists: true };
        }

        // Search in prompts
        if (search) {
            query.$text = { $search: search };
        }

        // Sort configuration
        const sortConfig = {};
        sortConfig[sortBy] = sortOrder === 'asc' ? 1 : -1;

        const [aiResponses, totalCount] = await Promise.all([
            AIResponse.find(query)
                .sort(sortConfig)
                .skip(skip)
                .limit(limit)
                .select('-__v'),
            AIResponse.countDocuments(query)
        ]);

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'AI responses retrieved successfully',
            data: {
                aiResponses,
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
            message: 'Failed to retrieve AI responses',
            status: false,
            error: error.message
        });
    }
};

/**
 * Get single AI response by ID
 */
const getAIResponse = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        await getAIResponseValidation.validate({ id });

        const aiResponse = await AIResponse.findOne({
            _id: id,
            userId
        }).select('-__v');

        if (!aiResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'AI response retrieved successfully',
            data: { aiResponse }
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
            message: 'Failed to retrieve AI response',
            status: false,
            error: error.message
        });
    }
};

/**
 * Update a specific model response (for manual corrections or retries)
 */
const updateModelResponse = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const updateData = req.body;

        await updateModelResponseValidation.validate({ id, ...updateData });

        const aiResponse = await AIResponse.findOne({ _id: id, userId });

        if (!aiResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        // Update the specific model response
        aiResponse.updatedBy = userId;
        await aiResponse.updateModelResponse(updateData.model, {
            response: updateData.response,
            status: updateData.status,
            errorMessage: updateData.errorMessage,
            tokens: updateData.tokens,
            responseTime: updateData.responseTime
        });

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Model response updated successfully',
            data: { aiResponse }
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
            message: 'Failed to update model response',
            status: false,
            error: error.message
        });
    }
};

/**
 * Delete AI response
 */
const deleteAIResponse = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        await deleteAIResponseValidation.validate({ id });

        const aiResponse = await AIResponse.findOneAndDelete({
            _id: id,
            userId
        });

        if (!aiResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'AI response deleted successfully'
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
            message: 'Failed to delete AI response',
            status: false,
            error: error.message
        });
    }
};

/**
 * Get AI usage statistics
 */
const getAIStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const { startDate, endDate, model } = req.query;

        await getAIStatsValidation.validate(req.query);

        let matchQuery = { userId };

        // Date range filter
        if (startDate || endDate) {
            matchQuery.createdAt = {};
            if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
            if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
        }

        // Model filter
        let modelFilter = {};
        if (model) {
            modelFilter[`${model}_response.status`] = 'success';
        }

        const pipeline = [
            { $match: { ...matchQuery, ...modelFilter } },
            {
                $group: {
                    _id: null,
                    totalRequests: { $sum: 1 },
                    totalTokensUsed: { $sum: '$totalTokensUsed' },
                    totalCost: { $sum: '$totalCost' },
                    avgResponseTime: { $avg: '$totalDuration' },
                    completedRequests: {
                        $sum: { $cond: [{ $eq: ['$overallStatus', 'completed'] }, 1, 0] }
                    },
                    partialRequests: {
                        $sum: { $cond: [{ $eq: ['$overallStatus', 'partial'] }, 1, 0] }
                    },
                    failedRequests: {
                        $sum: { $cond: [{ $eq: ['$overallStatus', 'failed'] }, 1, 0] }
                    }
                }
            }
        ];

        const [stats] = await AIResponse.aggregate(pipeline);

        // Get model-specific stats
        const modelStats = {};
        const models = ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];

        for (const modelName of models) {
            const modelPipeline = [
                {
                    $match: {
                        ...matchQuery,
                        [`${modelName}_response.status`]: 'success'
                    }
                },
                {
                    $group: {
                        _id: null,
                        successfulResponses: { $sum: 1 },
                        totalTokens: { $sum: `$${modelName}_response.tokens.total` },
                        avgResponseTime: { $avg: `$${modelName}_response.responseTime` }
                    }
                }
            ];

            const [modelStat] = await AIResponse.aggregate(modelPipeline);
            modelStats[modelName] = modelStat || {
                successfulResponses: 0,
                totalTokens: 0,
                avgResponseTime: 0
            };
        }

        // Get provider status
        const providerStatus = aiService.getProviderStatus();

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'AI statistics retrieved successfully',
            data: {
                overall: stats || {
                    totalRequests: 0,
                    totalTokensUsed: 0,
                    totalCost: 0,
                    avgResponseTime: 0,
                    completedRequests: 0,
                    partialRequests: 0,
                    failedRequests: 0
                },
                modelStats,
                providerStatus
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
            message: 'Failed to retrieve AI statistics',
            status: false,
            error: error.message
        });
    }
};

/**
 * Retry failed model responses
 */
const retryFailedResponses = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        await getAIResponseValidation.validate({ id });

        const aiResponse = await AIResponse.findOne({ _id: id, userId });

        if (!aiResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        // Get failed models
        const failedModels = [];
        const models = ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];

        models.forEach(model => {
            const responseField = `${model}_response`;
            if (aiResponse[responseField] && aiResponse[responseField].status === 'error') {
                failedModels.push(model);
            }
        });

        if (failedModels.length === 0) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'No failed responses to retry'
            });
        }

        // Retry failed models
        const { responses } = await aiService.generateMultiModelResponse(
            aiResponse.prompt,
            {
                ...aiResponse.settings,
                enabledModels: failedModels
            }
        );

        // Update only the failed responses
        Object.keys(responses).forEach(key => {
            if (failedModels.some(model => key === `${model}_response`)) {
                aiResponse[key] = responses[key];
            }
        });

        aiResponse.updatedBy = userId;
        await aiResponse.save();

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Failed responses retried successfully',
            data: { aiResponse }
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
            message: 'Failed to retry responses',
            status: false,
            error: error.message
        });
    }
};

/**
 * Select a preferred response and remove others
 */

const selectPreferredResponse = async (req, res) => {
    try {
        const { id } = req.params;
        const { model } = req.body;
        const userId = req.user._id;

        await selectPreferredResponseValidation.validate({ id, model });

        // First verification pass - check if it exists and has the response
        const checkResponse = await AIResponse.findOne({ _id: id, userId });

        if (!checkResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        const selectedResponseField = `${model}_response`;
        if (!checkResponse[selectedResponseField] || !checkResponse[selectedResponseField].response) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Selected model response does not exist'
            });
        }

        // Prepare update operations
        const models = ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];
        const unsetFields = {};

        models.forEach(m => {
            if (m !== model) {
                unsetFields[`${m}_response`] = ""; // Value doesn't matter for $unset
            }
        });

        console.log(`[SelectPreferred] Attempting update for ${id}`, {
            modelToKeep: model,
            unsetFields: Object.keys(unsetFields)
        });

        // Use findOneAndUpdate for atomic and reliable update
        const aiResponse = await AIResponse.findOneAndUpdate(
            { _id: id, userId },
            {
                $unset: unsetFields,
                $set: {
                    'settings.enabledModels': [model],
                    totalModels: 1,
                    completedModels: 1,
                    failedModels: 0,
                    overallStatus: 'completed',
                    updatedBy: userId
                }
            },
            { new: true } // Return updated document
        );

        if (aiResponse) {
            console.log(`[SelectPreferred] Update successful. Enabled models:`, aiResponse.settings.enabledModels);
            // Verify specific field removal
            const remaining = models.filter(m => aiResponse[`${m}_response`]);
            console.log(`[SelectPreferred] Remaining response fields:`, remaining);
        } else {
            console.error(`[SelectPreferred] Update failed - document not returned`);
        }

        // 2. Update Project Settings
        if (aiResponse.projectId) {
            const Project = (await import('../project/project.model.js')).default;
            await Project.updateOne(
                { _id: aiResponse.projectId },
                {
                    $set: {
                        'settings.enabledModels': [model]
                    }
                }
            );
        }

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Preferred response selected and project settings updated',
            data: { aiResponse }
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
            message: 'Failed to select preferred response',
            status: false,
            error: error.message
        });
    }
};

export const aiController = {
    generateAIResponse,
    listAIResponses,
    getAIResponse,
    updateModelResponse,
    deleteAIResponse,
    getAIStatsValidation,
    retryFailedResponses,
    selectPreferredResponse,
    getAIStats
};
