import moment from 'moment';
import { getDataFromQuery } from './requestHelper';
import mongoose from 'mongoose';

const removeObjectEmptyValues = (obj) =>
  obj
    ? Object.fromEntries(
      Object.entries(obj).filter(
        ([_, v]) => ![null, '', undefined].includes(v)
      )
    )
    : null;

/**
 * @param arr input array
 * @returns new array after removing blank (null, undefined, '') values
 */
const removeArrayNullValues = (arr) =>
  arr?.filter((v) => ![null, '', undefined].includes(v));

/**
 * @param value input array
 * @returns new value after removing blank (null, undefined, '') values
 * @description removes blank (null, undefined, '') values from array & object, other types are returned as it is
 */
export const removeNullValues = (value) => {
  if (Array.isArray(value)) {
    return removeArrayNullValues(value);
  }

  if (typeof value === 'object') {
    return removeObjectEmptyValues(value);
  }

  return value;
};

export const getFormattedCode = (prefix, value) =>
  prefix + value?.toString()?.padStart(4, '0');

export const getCommonSearchConditionForMasters = (search, fields = []) => {
  const isNumeric = !isNaN(search);

  const conditions = [
    { 'name': { $regex: search, $options: 'i' } },
    { 'name.english': { $regex: search, $options: 'i' } },
    { 'name.hindi': { $regex: search, $options: 'i' } },
    { 'name.hinglish': { $regex: search, $options: 'i' } },
    { 'email': { $regex: search, $options: 'i' } },
    { 'mobile': { $regex: search, $options: 'i' } },
  ];

  if (isNumeric) {
    conditions.push({ code: Number(search) });
  }

  if (fields.length > 0) {
    fields.forEach((field) => {
      conditions.push({ [field]: { $regex: search, $options: 'i' } });
    });
  }

  return conditions.filter(Boolean);
};

export const getCommonFilterConditionForMasters = (req) => {
  const stateId = getDataFromQuery(req, 'stateId');
  const districtId = getDataFromQuery(req, 'districtId');
  const tehsilId = getDataFromQuery(req, 'tehsilId');
  const villageId = getDataFromQuery(req, 'villageId');
  const conditions = [
    (stateId ? { 'state': new mongoose.Types.ObjectId(stateId) } : null),
    (districtId ? { 'district': new mongoose.Types.ObjectId(districtId) } : null),
    (tehsilId ? { 'tehsil': new mongoose.Types.ObjectId(tehsilId) } : null),
    (villageId ? { 'village': new mongoose.Types.ObjectId(villageId) } : null),
  ];

  return conditions.filter(Boolean);
};

export const getCommonSearchConditionForProfile = (search) => {
  const isNumeric = !isNaN(search);

  const conditions = [
    { 'userId.name.english': { $regex: search, $options: 'i' } },
    { 'userId.name.hindi': { $regex: search, $options: 'i' } },
    { 'userId.name.hinglish': { $regex: search, $options: 'i' } },
    { 'userId.email': { $regex: search, $options: 'i' } },
    { 'userId.mobile': { $regex: search, $options: 'i' } },
  ];

  if (isNumeric) {
    conditions.push({ 'userId.code': Number(search) }); // if such a field exists
  }

  return conditions;
};


export const formatDate = (date) => {
  if (!date) return null;
  const momentDate = moment(date, 'DD/MM/YYYY');
  if (
    momentDate.isValid() &&
    momentDate.year() > 1000 &&
    momentDate.year() < 3000
  ) {
    return momentDate.format();
  } else {
    return null;
  }
};

export const getCommonSearchConditionForRoute = (search) => {
  const numericSearch = parseInt(search.replace(/\D/g, ''), 10);

  return [
    { name: { $regex: search, $options: 'i' } },
    { code: { $regex: search, $options: 'i' } },

    !isNaN(numericSearch) && { code: numericSearch },
  ].filter(Boolean);
};
export const separateNames = (fullName) => {
  const regex = /^(.+?)\((.+)\)$/;
  const match = fullName.match(regex);

  if (match) {
    const englishName = match[1].trim();
    const hindiName = match[2].trim();
    return { englishName, hindiName };
  }
};
export const getSearchConditionForUser = (search) => {
  return [
    { loginEmail: { $regex: search, $options: 'i' } },
    { loginMobile: { $regex: search, $options: 'i' } },
    { designation: { $regex: search, $options: 'i' } },
    { 'name.english': { $regex: search, $options: 'i' } },
    { 'name.hindi': { $regex: search, $options: 'i' } },
    { 'name.hinglish': { $regex: search, $options: 'i' } },
  ];
};
export const capitalizeFirstLetter = (str) => {
  str = String(str);
  if (typeof str !== 'string') {
    return '';
  }

  if (str.trim() === '') {
    return '';
  }

  return str
    .trim()
    .split(/\s+/) // Split by any whitespace characters (including multiple spaces)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};
