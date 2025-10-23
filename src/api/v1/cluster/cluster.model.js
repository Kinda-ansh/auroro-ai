import mongoose from 'mongoose';
import uniqueValidator from 'mongoose-unique-validator';
import { getFormattedCode } from '../../../utils/commonHelper';
const { Schema, model } = mongoose;
const AutoIncrement = require('mongoose-sequence')(mongoose);

const clusterSchema = new Schema(
  {
    code: {
      type: Number,
      unique: true,
      trim: true,
      get: (val) => getFormattedCode('CLUS', val),
    },

    state: {
      type: Schema.Types.ObjectId,
      ref: 'State',
      required: true,
    },
    district: {
      type: Schema.Types.ObjectId,
      ref: 'District',
      required: true,
    },
    tehsil: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Tehsil',
        required: true,
      }
    ],

    village: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Village',
        required: true,
      }
    ],


    name: {
      english: {
        type: String,
        required: [true, 'English name is required'],
        trim: true,
      },
      hindi: {
        type: String,
        trim: true,
        index: {
          unique: true,
          partialFilterExpression: { hindi: { $type: 'string' } },
        },
        default: null,
      },
    },
    shortName: {
      english: { type: String, trim: true },
      hindi: { type: String, trim: true },
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
  }
);

clusterSchema.methods.softDelete = async function (userId) {
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

clusterSchema.plugin(uniqueValidator, { message: '{PATH} should be unique.' });
clusterSchema.plugin(AutoIncrement, {
  inc_field: 'code',
  id: 'cluster',
});

const Cluster = model('Cluster', clusterSchema);
export default Cluster;
