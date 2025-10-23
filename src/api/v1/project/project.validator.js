import * as yup from 'yup';

export const createProjectValidation = yup.object({
    name: yup.string().required('Project name is required').max(100),
    description: yup.string().max(500),
    settings: yup.object({
        temperature: yup.number().min(0).max(2),
        maxTokens: yup.number().min(100).max(10000),
        enabledModels: yup.array().of(
            yup.string().oneOf(['gemini', 'openai', 'deepseek', 'microsoft', 'llama'])
        )
    })
});

export const updateProjectValidation = yup.object({
    id: yup.string().required(),
    name: yup.string().max(100),
    description: yup.string().max(500),
    settings: yup.object({
        temperature: yup.number().min(0).max(2),
        maxTokens: yup.number().min(100).max(10000),
        enabledModels: yup.array().of(
            yup.string().oneOf(['gemini', 'openai', 'deepseek', 'microsoft', 'llama'])
        )
    }),
    isArchived: yup.boolean()
});

export const getProjectValidation = yup.object({
    id: yup.string().required()
});

export const deleteProjectValidation = yup.object({
    id: yup.string().required()
});

export const listProjectsValidation = yup.object({
    page: yup.number().min(1).default(1),
    limit: yup.number().min(1).max(100).default(20),
    search: yup.string(),
    isArchived: yup.boolean()
});
