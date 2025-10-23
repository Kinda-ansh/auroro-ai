import * as yup from 'yup';
import mongoose from 'mongoose';

export const generateAIResponseValidation = yup.object().shape({
    prompt: yup
        .string()
        .trim()
        .required('Prompt is required')
        .min(1, 'Prompt must have at least 1 character')
        .max(10000, 'Prompt must not exceed 10000 characters'),

    projectId: yup
        .string()
        .optional()
        .test('is-object-id', 'Invalid Project ID format', (value) => {
            if (!value) return true; // Optional
            return mongoose.Types.ObjectId.isValid(value);
        }),

    settings: yup.object().shape({
        temperature: yup
            .number()
            .min(0, 'Temperature must be between 0 and 2')
            .max(2, 'Temperature must be between 0 and 2')
            .default(0.7),

        maxTokens: yup
            .number()
            .min(1, 'Max tokens must be at least 1')
            .max(8000, 'Max tokens must not exceed 8000')
            .default(2000),

        enabledModels: yup
            .array()
            .of(yup.string().oneOf(['gemini', 'openai', 'deepseek', 'microsoft', 'llama']))
            .min(1, 'At least one model must be enabled')
            .default(['gemini', 'openai', 'deepseek', 'microsoft', 'llama'])
            .optional()
    }).optional().default({})
});

export const getAIResponseValidation = yup.object().shape({
    id: yup
        .string()
        .required('AI Response ID is required')
        .test('is-object-id', 'Invalid AI Response ID format', (value) => {
            return mongoose.Types.ObjectId.isValid(value);
        })
});

export const listAIResponsesValidation = yup.object().shape({
    page: yup
        .number()
        .min(1, 'Page must be at least 1')
        .default(1),

    limit: yup
        .number()
        .min(1, 'Limit must be at least 1')
        .max(100, 'Limit must not exceed 100')
        .default(20),

    search: yup
        .string()
        .trim()
        .optional(),

    status: yup
        .string()
        .oneOf(['processing', 'completed', 'partial', 'failed'])
        .optional(),

    model: yup
        .string()
        .oneOf(['gemini', 'openai', 'deepseek', 'microsoft', 'llama'])
        .optional(),

    projectId: yup
        .string()
        .test('is-object-id', 'Invalid Project ID format', (value) => {
            if (!value) return true; // Optional
            return mongoose.Types.ObjectId.isValid(value);
        })
        .optional(),

    sortBy: yup
        .string()
        .oneOf(['createdAt', 'updatedAt', 'totalDuration', 'totalTokensUsed'])
        .default('createdAt'),

    sortOrder: yup
        .string()
        .oneOf(['asc', 'desc'])
        .default('desc')
});

export const updateModelResponseValidation = yup.object().shape({
    id: yup
        .string()
        .required('AI Response ID is required')
        .test('is-object-id', 'Invalid AI Response ID format', (value) => {
            return mongoose.Types.ObjectId.isValid(value);
        }),

    model: yup
        .string()
        .required('Model name is required')
        .oneOf(['gemini', 'openai', 'deepseek', 'microsoft', 'llama']),

    response: yup
        .string()
        .trim()
        .optional(),

    status: yup
        .string()
        .oneOf(['pending', 'success', 'error'])
        .required('Status is required'),

    errorMessage: yup
        .string()
        .trim()
        .optional(),

    tokens: yup.object().shape({
        prompt: yup.number().min(0).optional(),
        completion: yup.number().min(0).optional(),
        total: yup.number().min(0).optional()
    }).optional(),

    responseTime: yup
        .number()
        .min(0)
        .optional()
});

export const deleteAIResponseValidation = yup.object().shape({
    id: yup
        .string()
        .required('AI Response ID is required')
        .test('is-object-id', 'Invalid AI Response ID format', (value) => {
            return mongoose.Types.ObjectId.isValid(value);
        })
});

export const getAIStatsValidation = yup.object().shape({
    startDate: yup
        .date()
        .optional(),

    endDate: yup
        .date()
        .optional()
        .test('is-after-start', 'End date must be after start date', function (value) {
            const { startDate } = this.parent;
            if (startDate && value) {
                return value > startDate;
            }
            return true;
        }),

    model: yup
        .string()
        .oneOf(['gemini', 'openai', 'deepseek', 'microsoft', 'llama'])
        .optional()
});
