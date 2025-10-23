import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const projectSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        userId: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        settings: {
            temperature: { type: Number, default: 0.7, min: 0, max: 2 },
            maxTokens: { type: Number, default: 2000 },
            enabledModels: [{
                type: String,
                enum: ['gemini', 'openai', 'deepseek', 'microsoft', 'llama']
            }]
        },
        isArchived: {
            type: Boolean,
            default: false
        },
        createdBy: { type: mongoose.Types.ObjectId, ref: 'User' },
        updatedBy: { type: mongoose.Types.ObjectId, ref: 'User' },
    },
    {
        timestamps: true,
        toJSON: { getters: true }
    }
);

// Indexes
projectSchema.index({ userId: 1, createdAt: -1 });
projectSchema.index({ name: 'text', description: 'text' });

const Project = model('Project', projectSchema);

export default Project;
