import 'dotenv/config';
import connectDB from './config/db';
import logger from './utils/logger';
import { createApp } from './app';

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ems';

// connect to DB
connectDB(MONGO_URI);

const app = createApp();

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
