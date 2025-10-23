const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const dotenv = require('dotenv');
const crypto = require('crypto');
const path = require('path');
const { default: createResponse } = require('../../../utils/response');
const { default: httpStatus } = require('../../../utils/httpStatus');

dotenv.config();

// S3 client config
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Multer setup
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Helper to generate unique filenames
const generateUniqueFileName = (originalName) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  const extension = path.extname(originalName);
  return `${timestamp}-${randomString}${extension}`;
};

// Single file upload handler
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    const uniqueFileName = generateUniqueFileName(file.originalname);
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: uniqueFileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: 'File uploaded successfully',
      data: {
        location: [fileUrl]
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Failed to upload file',
      error: error.message,
    });
  }
};

// Multiple files upload handler
const uploadMultipleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploadResults = await Promise.all(
      req.files.map(async (file) => {
        const uniqueFileName = generateUniqueFileName(file.originalname);
        const params = {
          Bucket: process.env.AWS_S3_BUCKET_NAME,
          Key: uniqueFileName,
          Body: file.buffer,
          ContentType: file.mimetype,
        };
        const command = new PutObjectCommand(params);
        await s3Client.send(command);
        const fileUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uniqueFileName}`;
        return {
          fileUrl,
          fileName: uniqueFileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        };
      })
    );

    return createResponse({
      res,
      statusCode: httpStatus.OK,
      status: true,
      message: `Successfully uploaded ${uploadResults.length} files`,
      data: uploadResults,
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    return createResponse({
      res,
      statusCode: httpStatus.INTERNAL_SERVER_ERROR,
      status: false,
      message: 'Failed to upload files',
      error: error.message,
    });
  }
};

module.exports = {
  FileUploadController: {
    uploadFile,
    uploadMultipleFiles,
    upload,
  },
};