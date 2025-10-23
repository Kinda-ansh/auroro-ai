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

export const createVillageSchema = yup.object({
  lgd: yup.string().nullable(),

  state: objectId.required('State is required'),
  district: objectId.required('District is required'),

  tehsil: yup
    .array()
    .of(objectId.required('Each tehsil ID must be valid'))
    .min(1, 'At least one tehsil must be selected')
    .required('Tehsil is required'),

  village: yup
    .array()
    .of(objectId.required('Each village ID must be valid'))
    .min(1, 'At least one village must be selected')
    .required('Village is required'),

  // block: objectId.required('Block is required'),

  name: yup.object({
    english: yup.string().required('English name is required').trim(),
    hindi: yup.string().trim().nullable(),
  }),

  shortName: yup.object({
    english: yup.string().trim().nullable(),
    hindi: yup.string().trim().nullable(),
  }),

  createdBy: objectId,
  updatedBy: objectId,

  isActive: yup.boolean().default(true),
});

export const updateVillageSchema = yup.object({
  lgd: yup.string().nullable(),

  state: objectId.optional().test('not-empty', 'State cannot be empty', (v) => v !== ''),
  district: objectId.optional().test('not-empty', 'District cannot be empty', (v) => v !== ''),

  tehsil: yup
    .array()
    .of(objectId.required('Each tehsil ID must be valid'))
    .min(1, 'At least one tehsil must be selected')
    .optional(),

  village: yup
    .array()
    .of(objectId.required('Each village ID must be valid'))
    .min(1, 'At least one village must be selected')
    .optional(),

  // block: objectId.optional().test('not-empty', 'Block cannot be empty', (v) => v !== ''),

  name: yup
    .object({
      english: nonEmptyString('English name'),
      hindi: yup.string().trim().nullable(),
    })
    .optional(),

  shortName: yup
    .object({
      english: yup.string().trim().nullable(),
      hindi: yup.string().trim().nullable(),
    })
    .optional(),

  updatedBy: objectId.required('UpdatedBy is required'),
  isActive: yup.boolean().optional(),
});
