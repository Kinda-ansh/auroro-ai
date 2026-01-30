import axios from 'axios';

/**
 * AI Service for handling multiple AI model integrations
 * This service provides a unified interface for different AI providers
 */

class AIService {
    constructor() {
        // Check if we're in test/development mode
        this.testMode = process.env.AI_TEST_MODE === 'true' || process.env.NODE_ENV === 'development';

        // Using OpenRouter for unified API access (similar to frontend)
        this.openRouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';

        this.providers = {
            gemini: {
                name: 'Gemini',
                apiModel: 'google/gemini-2.0-flash-exp:free',
                apiKey: process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY,
                enabled: !!(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY) || this.testMode
            },
            deepseek: {
                name: 'DeepSeek',
                apiModel: 'tngtech/deepseek-r1t2-chimera:free',
                apiKey: process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY,
                enabled: !!(process.env.OPENROUTER_API_KEY || process.env.DEEPSEEK_API_KEY) || this.testMode
            },
            microsoft: {
                name: 'Microsoft MAI',
                apiModel: 'microsoft/mai-ds-r1:free',
                apiKey: process.env.OPENROUTER_API_KEY || process.env.MICROSOFT_API_KEY,
                enabled: !!(process.env.OPENROUTER_API_KEY || process.env.MICROSOFT_API_KEY) || this.testMode
            },
            llama: {
                name: 'Llama',
                apiModel: 'meta-llama/llama-4-maverick:free',
                apiKey: process.env.OPENROUTER_API_KEY || process.env.LLAMA_API_KEY,
                enabled: !!(process.env.OPENROUTER_API_KEY || process.env.LLAMA_API_KEY) || this.testMode
            },
            // Keep OpenAI as it was working
            openai: {
                name: 'OpenAI',
                apiModel: 'openai/gpt-oss-20b:free',
                apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY,
                enabled: !!(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY) || this.testMode
            }
        };
    }

    /**
     * Get enabled AI providers
     */
    getEnabledProviders() {
        return Object.entries(this.providers)
            .filter(([key, provider]) => provider.enabled)
            .map(([key, provider]) => ({ key, ...provider }));
    }

    /**
     * Generate mock response for testing
     */
    generateMockResponse(modelName, prompt, settings = {}) {
        const responses = [
            `This is a mock response from ${modelName} for the prompt: "${prompt.substring(0, 50)}..."`,
            `${modelName} would typically analyze this prompt and provide a detailed response based on its training data.`,
            `Mock ${modelName} response: The prompt discusses interesting topics that would require thoughtful analysis.`,
            `${modelName} simulation: This is a test response generated for development purposes.`
        ];

        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const mockTokens = Math.floor(Math.random() * 100) + 50;

        return {
            model: modelName,
            response: randomResponse,
            status: 'success',
            tokens: {
                prompt: Math.floor(mockTokens * 0.7),
                completion: Math.floor(mockTokens * 0.3),
                total: mockTokens
            },
            responseTime: Math.floor(Math.random() * 2000) + 500 // 500-2500ms
        };
    }

    /**
     * Unified method to call OpenRouter API (similar to frontend approach)
     */
    async callOpenRouter(modelName, apiModel, prompt, settings = {}) {
        const startTime = Date.now();

        try {
            const provider = this.providers[modelName];
            if (!provider.enabled) {
                throw new Error(`${modelName} is not enabled`);
            }

            // Return mock response in test mode when no API key is provided
            if (this.testMode && !provider.apiKey) {
                await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500)); // Simulate API delay
                return this.generateMockResponse(modelName, prompt, settings);
            }

            if (!provider.apiKey) {
                throw new Error(`${modelName} API key not configured - Please set OPENROUTER_API_KEY in environment variables`);
            }

            // Build conversation history if previousResponseId is provided
            const messages = [];

            if (settings.previousResponseId) {
                try {
                    const AIResponse = (await import('../api/v1/ai/ai.model.js')).default;
                    const prevResponse = await AIResponse.findById(settings.previousResponseId);

                    if (prevResponse) {
                        // Add original prompt and selected model's response
                        messages.push({
                            role: 'user',
                            content: [{ type: 'text', text: prevResponse.prompt }]
                        });

                        const prevModelResponse = prevResponse[`${modelName}_response`]?.response;
                        if (prevModelResponse) {
                            messages.push({
                                role: 'assistant',
                                content: [{ type: 'text', text: prevModelResponse }]
                            });
                        }
                        console.log(`[${modelName}] Added conversation history from ${settings.previousResponseId}`);
                    }
                } catch (err) {
                    console.error(`[${modelName}] Error fetching history:`, err);
                }
            }

            // Add the current prompt
            messages.push({
                role: 'user',
                content: [{
                    type: 'text',
                    text: prompt
                }]
            });

            const requestData = {
                model: apiModel,
                messages: messages,
                temperature: settings.temperature || 0.7,
                max_tokens: settings.maxTokens || 2000
            };

            console.log(`[${modelName}] Calling OpenRouter API with model: ${apiModel}`);

            const response = await axios.post(
                this.openRouterEndpoint,
                requestData,
                {
                    headers: {
                        'Authorization': `Bearer ${provider.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5000',
                        'X-Title': process.env.OPENROUTER_SITE_TITLE || 'Auroro AI Backend'
                    },
                    timeout: 60000 // Increased timeout to 60 seconds for Gemini
                }
            );

            const responseTime = Date.now() - startTime;
            const content = response.data.choices?.[0]?.message?.content || '';
            const usage = response.data.usage || {};

            console.log(`[${modelName}] Response received successfully in ${responseTime}ms`);

            return {
                model: modelName,
                response: content,
                status: 'success',
                tokens: {
                    prompt: usage.prompt_tokens || 0,
                    completion: usage.completion_tokens || 0,
                    total: usage.total_tokens || 0
                },
                responseTime,
                createdAt: new Date()
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;

            // Enhanced error logging for debugging
            console.error(`[${modelName}] Error after ${responseTime}ms:`, {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
                statusText: error.response?.statusText
            });

            // Extract detailed error message from OpenRouter response
            let errorMessage = error.message;
            if (error.response?.data) {
                errorMessage = error.response.data.error?.message
                    || error.response.data.message
                    || JSON.stringify(error.response.data);
            }

            return {
                model: modelName,
                response: '',
                status: 'error',
                errorMessage: `${modelName} Error: ${errorMessage}`,
                tokens: { prompt: 0, completion: 0, total: 0 },
                responseTime,
                createdAt: new Date()
            };
        }
    }

    /**
     * Generate response from Gemini
     */
    async generateGeminiResponse(prompt, settings = {}) {
        return this.callOpenRouter('gemini', this.providers.gemini.apiModel, prompt, settings);
    }

    /**
     * Generate response from OpenAI
     */
    async generateOpenAIResponse(prompt, settings = {}) {
        return this.callOpenRouter('openai', this.providers.openai.apiModel, prompt, settings);
    }

    /**
     * Generate response from Microsoft MAI
     */
    async generateMicrosoftResponse(prompt, settings = {}) {
        return this.callOpenRouter('microsoft', this.providers.microsoft.apiModel, prompt, settings);
    }

    /**
     * Generate response from Llama
     */
    async generateLlamaResponse(prompt, settings = {}) {
        return this.callOpenRouter('llama', this.providers.llama.apiModel, prompt, settings);
    }

    /**
     * Generate response from DeepSeek
     */
    async generateDeepSeekResponse(prompt, settings = {}) {
        return this.callOpenRouter('deepseek', this.providers.deepseek.apiModel, prompt, settings);
    }

    /**
     * Generate response from a single model (generic method)
     */
    async generateSingleModelResponse(modelName, prompt, settings = {}) {
        const provider = this.providers[modelName];
        if (!provider) {
            throw new Error(`Unknown model: ${modelName}`);
        }
        if (!provider.enabled) {
            throw new Error(`Model ${modelName} is not enabled or configured`);
        }
        return this.callOpenRouter(modelName, provider.apiModel, prompt, settings);
    }

    /**
     * Generate responses from multiple AI models concurrently
     */
    async generateMultiModelResponse(prompt, settings = {}) {
        const enabledModels = settings.enabledModels || ['gemini', 'openai', 'deepseek', 'microsoft', 'llama'];
        const availableModels = enabledModels.filter(model => this.providers[model]?.enabled);

        if (availableModels.length === 0) {
            throw new Error('No AI models are configured and enabled');
        }

        const promises = availableModels.map(async (model) => {
            try {
                switch (model) {
                    case 'gemini':
                        return await this.generateGeminiResponse(prompt, settings);
                    case 'openai':
                        return await this.generateOpenAIResponse(prompt, settings);
                    case 'deepseek':
                        return await this.generateDeepSeekResponse(prompt, settings);
                    case 'microsoft':
                        return await this.generateMicrosoftResponse(prompt, settings);
                    case 'llama':
                        return await this.generateLlamaResponse(prompt, settings);
                    default:
                        return {
                            model,
                            response: '',
                            status: 'error',
                            errorMessage: 'Unknown model',
                            tokens: { prompt: 0, completion: 0, total: 0 },
                            responseTime: 0
                        };
                }
            } catch (error) {
                return {
                    model,
                    response: '',
                    status: 'error',
                    errorMessage: error.message,
                    tokens: { prompt: 0, completion: 0, total: 0 },
                    responseTime: 0
                };
            }
        });

        const results = await Promise.allSettled(promises);
        const responses = {};

        results.forEach((result, index) => {
            const model = availableModels[index];
            if (result.status === 'fulfilled') {
                responses[`${model}_response`] = result.value;
            } else {
                responses[`${model}_response`] = {
                    model,
                    response: '',
                    status: 'error',
                    errorMessage: result.reason?.message || 'Unknown error',
                    tokens: { prompt: 0, completion: 0, total: 0 },
                    responseTime: 0
                };
            }
        });

        return {
            responses,
            totalModels: availableModels.length,
            availableModels
        };
    }

    /**
     * Get provider status
     */
    getProviderStatus() {
        return Object.entries(this.providers).map(([key, provider]) => ({
            name: key,
            displayName: provider.name,
            enabled: provider.enabled,
            configured: !!provider.apiKey
        }));
    }
}

export default new AIService();
