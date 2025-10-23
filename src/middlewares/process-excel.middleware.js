import xlsx from 'xlsx';
import fs from 'fs';

const processExcel = (req, res, next) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const workbook = xlsx.readFile(file.path);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);
  const headObj = data[0];
  // Set the file data on the request object
  if (data.length < 1) {
    return res.status(400).json({ message: data.length });
  }
  let name = Object.keys(headObj);
  let validName = ['No', 'Short Name', 'Region', 'Depot Name', 'District'];
  name = name.map((n) => n.trim());

  req.fileData = data;

  fs.unlink(file.path, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
    } else {
      console.log('File deleted successfully');
    }
  });

  next();
};

export default processExcel;
