import mongoose from 'mongoose';
import logger from '../utils/logger';

const connectDB = async (mongoUri: string) => {
  try {
    await mongoose.connect(mongoUri);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error('MongoDB connection error', err);
    process.exit(1);
  }
};

export default connectDB;
