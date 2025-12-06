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
        canvasNodes: [{
            id: String,
            type: {
                type: String,
                enum: ['circle', 'square', 'arrow', 'line', 'text', 'ai-response']
            },
            x: Number,
            y: Number,
            width: Number,
            height: Number,
            content: String,
            color: String,
            aiResponseId: { type: mongoose.Types.ObjectId, ref: 'AIResponse' } // Link to AI response if applicable
        }],
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
