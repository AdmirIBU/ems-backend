import 'dotenv/config';
import connectDB from './config/db';
import logger from './utils/logger';
import { createApp } from './app';
import { maybeSeedDemoData } from './seed/demoSeed';

const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ems';

async function main() {
  await connectDB(MONGO_URI);

  try {
    await maybeSeedDemoData();
  } catch (err) {
    logger.error('Demo seed failed', err);
  }

  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

main().catch((err) => {
  logger.error('Fatal startup error', err);
  process.exit(1);
});
