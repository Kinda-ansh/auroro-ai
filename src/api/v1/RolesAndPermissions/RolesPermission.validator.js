import * as yup from 'yup';
import mongoose from 'mongoose';

const objectId = yup
  .string()
  .nullable()
  .notRequired()
  .test('is-object-id', '${path} must be a valid MongoDB ObjectId', (value) =>
    value ? mongoose.Types.ObjectId.isValid(value) : true
  );

const nonEmptyString = (label) =>
  yup
    .string()
    .trim()
    .notOneOf(['', null], `${label} cannot be empty`)
    .optional();

export const createRoleSchema = yup.object({
  name: yup.string().required('Name is required').trim(),
  level: yup.string().required('Level is required').trim(),
  description: yup.string().required('Description is required').trim(),
  isDefault: yup.boolean().default(false),
  createdBy: objectId,
  updatedBy: objectId
});

export const updateRoleSchema = yup.object({
  name: nonEmptyString('Name').optional(),
  level: yup.string().optional().trim(),
  description: yup.string().optional().trim(),
  isDefault: yup.boolean().default(false),
  updatedBy: objectId.required('UpdatedBy is required'),
});
