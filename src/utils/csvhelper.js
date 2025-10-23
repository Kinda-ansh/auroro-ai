import fs from 'fs';
import csv from 'csv-parser';
import { Parser } from 'json2csv';
import path from 'path';

/**
 * Parse CSV and return rows
 */
export const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv({ separator: ',', skipLines: 0, quote: '"' }))
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

/**
 * Export JSON to CSV
 */
export const exportToCSV = (data, fields, filenamePrefix = 'export') => {
  try {
    const json2csv = new Parser({ fields, quote: '"' });
    const csv = json2csv.parse(data);

    // Create exports directory if not exists
    const exportDir = path.resolve('./exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    // Define file path and write CSV
    const fileName = `${filenamePrefix}-${Date.now()}.csv`;
    const filePath = path.join(exportDir, fileName);
   
fs.writeFileSync(filePath, '\uFEFF' + csv, 'utf8'); // Adds BOM for Excel support

    return filePath;
  } catch (error) {
    console.error('CSV export failed:', error);
    throw new Error('Failed to export CSV');
  }
};



/**
 * Bulk Insert/Update
 */
export const bulkUpsert = async (Model, data, uniqueKeys = []) => {
  const bulkOps = data.map((row) => {
    const filter = {};
    uniqueKeys.forEach((key) => {
      filter[key] = row[key];
    });
    return {
      updateOne: {
        filter,
        update: { $set: row },
        upsert: true,
      },
    };
  });

  const result = await Model.bulkWrite(bulkOps);
  return result;
};
