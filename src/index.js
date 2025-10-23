import config from './config';
import logger from './core/logger';
import { createServer } from './core/server';
import connectDB from './utils/db';
import dotenv from 'dotenv';

dotenv.config();

// connect db
connectDB();

const port = config.port || 8085;
const server = createServer();

server.listen(port, () => {
  logger.info(`api running on ${port}`);
});
