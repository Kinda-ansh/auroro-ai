//libs
import httpStatus from 'http-status';

//utilities
import createResponse from '../../../utils/response.js';

//models
import AIResponse from './ai.model.js';

//services
import aiService from '../../../services/ai.service.js';

/**
 * Generate response from a single AI model
 */
const generateSingleModelResponse = async (req, res) => {
    try {
        const { responseId, model } = req.params;
        const userId = req.user._id;

        // Validate model
        const validModels = ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];
        if (!validModels.includes(model)) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Invalid model specified'
            });
        }

        const aiResponse = await AIResponse.findOne({ _id: responseId, userId });

        if (!aiResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        // Check if model is enabled
        if (!aiResponse.settings.enabledModels.includes(model)) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Model is not enabled for this response'
            });
        }

        // Update status to pending
        aiResponse[`${model}_response`] = {
            model,
            status: 'pending',
            response: '',
            createdAt: new Date()
        };
        aiResponse.updatedBy = userId;
        await aiResponse.save();

        // Return immediately
        res.status(httpStatus.OK).json({
            status: true,
            message: 'Model response generation initiated',
            data: { aiResponse }
        });

        // Generate response in background
        try {
            const result = await aiService.generateSingleModelResponse(
                model,
                aiResponse.prompt,
                aiResponse.settings
            );

            aiResponse[`${model}_response`] = result;
            await aiResponse.save();
        } catch (error) {
            console.error(`Error generating ${model} response:`, error);
            aiResponse[`${model}_response`] = {
                model,
                status: 'error',
                errorMessage: error.message || 'Failed to generate response',
                createdAt: new Date()
            };
            await aiResponse.save();
        }

    } catch (error) {
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to generate model response',
            status: false,
            error: error.message
        });
    }
};

/**
 * Update/Edit a single model response
 */
const updateSingleModelResponse = async (req, res) => {
    try {
        const { responseId, model } = req.params;
        const userId = req.user._id;
        const { response } = req.body;

        // Validate model
        const validModels = ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];
        if (!validModels.includes(model)) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Invalid model specified'
            });
        }

        if (!response || typeof response !== 'string') {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Response content is required'
            });
        }

        const aiResponse = await AIResponse.findOne({ _id: responseId, userId });

        if (!aiResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        // Update the model response with edited content
        if (aiResponse[`${model}_response`]) {
            aiResponse[`${model}_response`].response = response;
            aiResponse[`${model}_response`].isEdited = true;
            aiResponse.updatedBy = userId;
            await aiResponse.save();

            return createResponse({
                res,
                statusCode: httpStatus.OK,
                status: true,
                message: 'Model response updated successfully',
                data: { aiResponse }
            });
        } else {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'Model response not found'
            });
        }

    } catch (error) {
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
 * Delete a single model response
 */
const deleteSingleModelResponse = async (req, res) => {
    try {
        const { responseId, model } = req.params;
        const userId = req.user._id;

        // Validate model
        const validModels = ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];
        if (!validModels.includes(model)) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Invalid model specified'
            });
        }

        const aiResponse = await AIResponse.findOne({ _id: responseId, userId });

        if (!aiResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        // Remove the model response
        aiResponse[`${model}_response`] = undefined;
        aiResponse.updatedBy = userId;
        await aiResponse.save();

        return createResponse({
            res,
            statusCode: httpStatus.OK,
            status: true,
            message: 'Model response deleted successfully',
            data: { aiResponse }
        });

    } catch (error) {
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to delete model response',
            status: false,
            error: error.message
        });
    }
};

/**
 * Retry a single model response
 */
const retrySingleModelResponse = async (req, res) => {
    try {
        const { responseId, model } = req.params;
        const userId = req.user._id;

        // Validate model
        const validModels = ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];
        if (!validModels.includes(model)) {
            return createResponse({
                res,
                statusCode: httpStatus.BAD_REQUEST,
                status: false,
                message: 'Invalid model specified'
            });
        }

        const aiResponse = await AIResponse.findOne({ _id: responseId, userId });

        if (!aiResponse) {
            return createResponse({
                res,
                statusCode: httpStatus.NOT_FOUND,
                status: false,
                message: 'AI response not found'
            });
        }

        // Update status to pending
        aiResponse[`${model}_response`] = {
            model,
            status: 'pending',
            response: '',
            createdAt: new Date()
        };
        aiResponse.updatedBy = userId;
        await aiResponse.save();

        // Return immediately
        res.status(httpStatus.OK).json({
            status: true,
            message: 'Model response retry initiated',
            data: { aiResponse }
        });

        // Retry in background
        try {
            const result = await aiService.generateSingleModelResponse(
                model,
                aiResponse.prompt,
                aiResponse.settings
            );

            aiResponse[`${model}_response`] = result;
            await aiResponse.save();
        } catch (error) {
            console.error(`Error retrying ${model} response:`, error);
            aiResponse[`${model}_response`] = {
                model,
                status: 'error',
                errorMessage: error.message || 'Failed to generate response',
                createdAt: new Date()
            };
            await aiResponse.save();
        }

    } catch (error) {
        return createResponse({
            res,
            statusCode: httpStatus.INTERNAL_SERVER_ERROR,
            message: 'Failed to retry model response',
            status: false,
            error: error.message
        });
    }
};

export const aiModelController = {
    generateSingleModelResponse,
    updateSingleModelResponse,
    deleteSingleModelResponse,
    retrySingleModelResponse
};
