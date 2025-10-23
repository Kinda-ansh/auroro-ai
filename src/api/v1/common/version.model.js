import mongoose, { Schema } from 'mongoose';

const versionModel = new mongoose.Schema(
    {
        version: {
            type: String,
            trim: true,
        },
        vStatus: {
            type: Boolean, default: false,
        },
        extraData: {
            LabelName: { type: String, default: '' },
            Url: { type: String, default: '' }
        }
    },
    {
        timestamps: true,
        toJSON: {
            getters: true,
        },
    }
);


const Version = mongoose.model('Version', versionModel);

export default Version;
