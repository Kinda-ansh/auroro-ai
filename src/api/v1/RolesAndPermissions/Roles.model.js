import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const roleSchema = new Schema({
  name: { type: String, unique: true },
  level: { type: String, enum: ['country', 'village', 'tehsil', 'district', 'state', 'own'], required: true },
  isDefault: { type: Boolean, default: false },
  description: { type: String },
  permissions: [{
    module: { type: String, required: true },
    actions: [{ type: String }],
    level: { type: String, enum: ['village', 'tehsil', 'district', 'state', 'own'] }
  }]
}, { timestamps: true });

const Role = model('Role', roleSchema);

export default Role;