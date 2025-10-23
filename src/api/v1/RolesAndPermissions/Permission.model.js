import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const permissionSchema = new Schema({
  module: { type: String, required: true },
  action: { type: String, required: true },
  description: { type: String, default: '' },
}, { timestamps: true });

export default model('Permission', permissionSchema);

// batch - create
// batch - edit
// batch - delete
// batch - view