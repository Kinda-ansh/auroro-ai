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

        let { prompt, projectId, previousResponseId, settings = {} } = payload;

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
            previousResponseId: previousResponseId || null,
            selectedModel: (previousResponseId && modelsToUse.length === 1) ? modelsToUse[0] : null,
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
        generateIndependentResponses(aiResponse._id, prompt, modelsToUse, {
            ...settings,
            previousResponseId: previousResponseId || null
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

        const page = Math.floor(skip / limit) + 1;

        const responses = await AIResponse.find(query)
            .sort(sortConfig)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .populate('userId', 'name email avatar')
            .populate('projectId', 'name')
            .select('-__v') // Keep the original select
            .lean(); // Use lean for performance

        // Debug logging to see what we are returning
        console.log(`[ListResponses] Returning ${responses.length} responses`);
        responses.forEach(r => {
            console.log(`[ListResponses] ID: ${r._id}`);
            console.log(`[ListResponses] Selected: ${r.selectedModel}`);
            console.log(`[ListResponses] Enabled: ${r.settings?.enabledModels}`);
            console.log(`[ListResponses] Models Present:`, {
                gemini: !!r.gemini_response,
                openai: !!r.openai_response,
                deepseek: !!r.deepseek_response,
                microsoft: !!r.microsoft_response,
                llama: !!r.llama_response
            });
        });

        // Get total count for pagination
        const total = await AIResponse.countDocuments(query);

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'AI responses retrieved successfully',
            data: {
                aiResponses: responses,
                count: total,
                page: Math.floor(skip / limit) + 1,
                totalPages: Math.ceil(total / limit)
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

        console.log(`[SelectPreferred] ========== START ==========`);
        console.log(`[SelectPreferred] Request received:`, { id, model, userId: userId.toString() });

        await selectPreferredResponseValidation.validate({ id, model });

        // Handle clearing selection (undo)
        if (model === '') {
            // Get the original response
            const aiResponse = await AIResponse.findOne({ _id: id, userId });

            if (!aiResponse) {
                return createResponse({
                    res,
                    statusCode: httpStatus.NOT_FOUND,
                    status: false,
                    message: 'AI response not found'
                });
            }

            console.log('[SelectPreferred] Undoing selection...');

            // Determine which models currently exist
            const models = ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];
            const existingModels = models.filter(m => aiResponse[`${m}_response`]);

            // Reset selection
            aiResponse.selectedModel = null;
            aiResponse.updatedBy = userId;

            // Restore enabled models list
            // If we have existing models, use them. If not (rare, or logic error), default to all.
            // Note: Since we deleted response fields on selection, we can't easily "restore" them if they're gone from DB
            // But we CAN restore the 'settings.enabledModels' list so the UI knows they *could* be there (or prompts re-run)
            // Actually, if we deleted the data, undoing "selection" won't bring back the text.
            // BUT, if the user just wants to see what's left, or re-run...

            // Wait, if we deleted the data in the "Done" step, then "Undo" CANNOT restore the text of the deleted models.
            // This is a trade-off. If we want Undo to fully work, we shouldn't delete the data, just hide it.
            // But the requirement was "remove others dynamically".

            // If the user wants full persistence + undo, we probably shouldn't delete the data, just rely on 'selectedModel' filter.
            // However, the user complained it "shows again on refresh", implying the filter logic failed.
            // So we went with hard deletion.
            // Now, strict Undo logic implies we just clear the 'selectedModel' flag.
            // The deleted models will remain deleted.

            aiResponse.settings.enabledModels = existingModels.length > 0 ? existingModels : models;

            await aiResponse.save();

            return createResponse({
                res,
                statusCode: httpStatus.OK,
                status: true,
                message: 'Selection cleared successfully',
                data: { aiResponse }
            });
        }

        // Fetch the document first
        const aiResponse = await AIResponse.findOne({ _id: id, userId });

        if (!aiResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        const selectedResponseField = `${model}_response`;
        if (!aiResponse[selectedResponseField] || !aiResponse[selectedResponseField].response) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Selected model response does not exist'
            });
        }

        console.log(`[SelectPreferred] Found response, updating (using native driver)...`);

        // Prepare $unset for all other models
        const models = ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];
        const unsetFields = {};
        models.forEach(m => {
            if (m !== model) {
                unsetFields[`${m}_response`] = ""; // Value doesn't matter for $unset
            }
        });

        // Use native MongoDB driver to bypass Mongoose schema re-population/validation issues
        const result = await AIResponse.collection.findOneAndUpdate(
            { _id: aiResponse._id },
            {
                $set: {
                    selectedModel: model,
                    overallStatus: 'completed',
                    updatedBy: userId,
                    'settings.enabledModels': [model]
                },
                $unset: unsetFields
            },
            { returnDocument: 'after' }
        );

        console.log(`[SelectPreferred] Native update result:`, result ? 'Success' : 'Failed');

        if (!result) {
            return createResponse({
                res,
                statusCode: httpStatus.INTERNAL_SERVER_ERROR,
                status: false,
                message: 'Failed to update response'
            });
        }

        // Return the updated document directly from result if available, or fetch it
        const updatedDoc = result.value || result;

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Preferred response selected and project settings updated',
            data: { aiResponse: updatedDoc }
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
