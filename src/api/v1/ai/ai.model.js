import mongoose from 'mongoose';

const { Schema, model } = mongoose;

// Schema for individual AI model responses
const aiModelResponseSchema = new Schema({
    model: { type: String, required: true },
    response: { type: String, trim: true },
    status: {
        type: String,
        enum: ['pending', 'success', 'error'],
        default: 'pending'
    },
    errorMessage: { type: String, trim: true },
    tokens: {
        prompt: { type: Number, default: 0 },
        completion: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },
    responseTime: { type: Number, default: 0 }, // in milliseconds
    isEdited: { type: Boolean, default: false }, // Track if response was manually edited
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

// Main AI response schema
const aiResponseSchema = new Schema(
    {
        prompt: {
            type: String,
            required: true,
            trim: true
        },
        userId: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        projectId: {
            type: mongoose.Types.ObjectId,
            ref: 'Project',
            required: false, // Auto-created if not provided
            index: true
        },
        // Individual AI model responses
        gemini_response: aiModelResponseSchema,
        openai_response: aiModelResponseSchema,
        deepseek_response: aiModelResponseSchema,
        microsoft_response: aiModelResponseSchema,
        llama_response: aiModelResponseSchema,

        // Overall request metadata
        totalModels: { type: Number, default: 0 },
        completedModels: { type: Number, default: 0 },
        failedModels: { type: Number, default: 0 },

        // Request settings
        settings: {
            temperature: { type: Number, default: 0.7, min: 0, max: 2 },
            maxTokens: { type: Number, default: 2000 },
            enabledModels: [{
                type: String,
                enum: ['gemini', 'openai', 'deepseek', 'microsoft', 'llama']
            }]
        },

        // Overall status
        overallStatus: {
            type: String,
            enum: ['processing', 'completed', 'partial', 'failed'],
            default: 'processing'
        },

        // Timing information
        startTime: { type: Date, default: Date.now },
        endTime: { type: Date },
        totalDuration: { type: Number, default: 0 }, // in milliseconds

        // Usage statistics
        totalTokensUsed: { type: Number, default: 0 },
        totalCost: { type: Number, default: 0 }, // estimated cost in USD

        // Metadata
        ipAddress: { type: String },
        userAgent: { type: String },
        createdBy: { type: mongoose.Types.ObjectId, ref: 'User' },
        updatedBy: { type: mongoose.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
        toJSON: { getters: true }
    }
);

// Indexes for better query performance
aiResponseSchema.index({ userId: 1, projectId: 1, createdAt: -1 });
aiResponseSchema.index({ projectId: 1, createdAt: -1 });
aiResponseSchema.index({ overallStatus: 1 });
aiResponseSchema.index({ prompt: 'text' }); // Text search on prompts

// Pre-save middleware to update statistics
aiResponseSchema.pre('save', function (next) {
    // Calculate completed and failed models
    const modelFields = ['gemini_response', 'openai_response', 'deepseek_response', 'microsoft_response', 'llama_response'];
    let completed = 0;
    let failed = 0;
    let totalTokens = 0;

    modelFields.forEach(field => {
        if (this[field] && this[field].status) {
            if (this[field].status === 'success') {
                completed++;
                totalTokens += this[field].tokens?.total || 0;
            } else if (this[field].status === 'error') {
                failed++;
            }
        }
    });

    this.completedModels = completed;
    this.failedModels = failed;
    this.totalTokensUsed = totalTokens;

    // Update overall status
    if (completed === this.totalModels) {
        this.overallStatus = 'completed';
        this.endTime = new Date();
        this.totalDuration = this.endTime - this.startTime;
    } else if (completed > 0 || failed > 0) {
        if (completed + failed === this.totalModels) {
            this.overallStatus = completed > 0 ? 'partial' : 'failed';
            this.endTime = new Date();
            this.totalDuration = this.endTime - this.startTime;
        }
    }

    next();
});

// Instance methods
aiResponseSchema.methods.updateModelResponse = function (modelName, responseData) {
    const fieldName = `${modelName}_response`;
    if (this[fieldName]) {
        Object.assign(this[fieldName], responseData);
    } else {
        this[fieldName] = responseData;
    }
    return this.save();
};

aiResponseSchema.methods.getSuccessfulResponses = function () {
    const modelFields = ['gemini_response', 'openai_response', 'deepseek_response', 'microsoft_response', 'llama_response'];
    const successful = {};

    modelFields.forEach(field => {
        const modelName = field.replace('_response', '');
        if (this[field] && this[field].status === 'success') {
            successful[modelName] = this[field];
        }
    });

    return successful;
};

aiResponseSchema.methods.getFailedResponses = function () {
    const modelFields = ['gemini_response', 'openai_response', 'deepseek_response', 'microsoft_response', 'llama_response'];
    const failed = {};

    modelFields.forEach(field => {
        const modelName = field.replace('_response', '');
        if (this[field] && this[field].status === 'error') {
            failed[modelName] = this[field];
        }
    });

    return failed;
};

const AIResponse = model('AIResponse', aiResponseSchema);

export default AIResponse;
