import path from 'path';
import express from 'express';
import cors from 'cors';
import morgan from './morgan';
import apiRoutes from '../api/index.routes';
import { parseCookies } from '../utils/index';
import logger from './logger.js';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import ExpressMongoSanitize from 'express-mongo-sanitize';
import session from 'express-session';
import config from '../config/index.js';
import MongoStore from 'connect-mongo';
import { errorConverter, errorHandler } from '../middlewares/error.middleware.js';
// import setupSwagger from './config/swagger';


const baseDir = path.resolve();

export const createServer = () => {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            'https://maps.googleapis.com',
            'https://www.google.com',
            'https://www.gstatic.com',
            'https://cdnjs.cloudflare.com',
            'https://cdn.jsdelivr.net',
            'https://checkout.razorpay.com',
            'https://lumberjack.razorpay.com',
            "'unsafe-inline'",
            "'unsafe-eval'",
            'blob:',
          ],
          mediaSrc: [
            "'self'",
            'blob:',
            'https://up-sdma.s3.ap-south-1.amazonaws.com/',
          ],
          styleSrc: [
            "'self'",
            'https://cdnjs.cloudflare.com',
            'https://fonts.googleapis.com',
            "'unsafe-inline'",
          ],
          fontSrc: [
            "'self'",
            'data:',
            'https://fonts.gstatic.com',
            'https://maps.googleapis.com',
          ],
          imgSrc: [
            "'self'",
            'data:',
            'https://maps.googleapis.com',
            'https://maps.gstatic.com',
            'https://maps.google.com',
            'https://up-sdma.s3.ap-south-1.amazonaws.com/',
            'https://openstreetmap.org',
            'https://*.tile.openstreetmap.org'
          ],
          connectSrc: [
            "'self'",
            'https://maps.googleapis.com',
            'https://www.google.com',
            'https://api.ipify.org',
            'https://cdn.jsdelivr.net',
            'https://checkout.razorpay.com',
            'data:',
            'blob:',
          ],
          frameSrc: [
            "'self'",
            'https://www.google.com',
            'https://checkout.razorpay.com',
            'https://api.razorpay.com',
            'https://maps.googleapis.com'
          ],
          objectSrc: ["'self'", 'blob:'],
          frameAncestors: ["'self'", 'blob:'],
          upgradeInsecureRequests: [],
        },
      },
    })
  );

  app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));
  app.use(helmet.noSniff()); // Sets X-Content-Type-Options to 'nosniff'

  // // Manually set Cache-Control, Clear-Site-Data headers
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, max-age=63115200');
    next();
  });

  /**
   * Serve static files from the 'dist' directory
   */

  app.use(express.static(path.join(baseDir, 'dist')));

  app.get('/api/file-metadata', async (req, res) => {
    const fileUrl = req.query.url; // Pass the file URL from the frontend

    try {
      // Use HEAD request to get metadata (size, last-modified, etc.)
      const response = await axios.head(fileUrl);

      const metadata = {
        fileName: fileUrl.split('/').pop(),
        fileSize: response.headers['content-length'],
        uploadDate: response.headers['last-modified'],
      };

      res.json(metadata);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching file metadata' });
    }
  });
  /**
   * Setup Swagger for API documentation
   */
  // setupSwagger(app);

  // Serve the frontend for all routes except those starting with '/api'
  app.use((req, res, next) => {
    if (!req.originalUrl.startsWith('/api')) {
      try {
        res.sendFile(path.join(__dirname, '../../', 'dist/index.html'));
      } catch (error) {
        console.error('Error serving frontend', error);
        res.status(500).send('Internal Server Error');
      }
    } else {
      next(); // Pass control to the next middleware for API routes
    }
  });

  app.use(cookieParser());

  /**
   * Setup logging using morgan
   */
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);

  // sanitize request data
  app.use(ExpressMongoSanitize());

  // parse urlencoded request body
  app.use(express.urlencoded({ extended: true }));

  // parse json request body
  app.use(express.json());
  /**
   * Attach logger to the request object
   */
  app.use((req, res, next) => {
    req.logger = logger;
    next();
  });

  /**
   * Enable Cross-Origin Resource Sharing (CORS) - allow all origins with credentials
   */
  app.set('trust proxy', 1);

  const corsOptions = {
    origin: true, // reflect request origin
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(
    session({
      secret: config.jwt.secret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({ mongoUrl: config.mongoose.url }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 12,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    })
  );

  /**
   * Register API routes
   */

  app.use('/api', apiRoutes);
  /**
   * Error handling middlewares
   * These should be placed after all other middlewares and routes
   */
  app.use(errorConverter); // Convert errors to ApiError if necessary
  app.use(errorHandler); // Handle errors

  return app;
};
