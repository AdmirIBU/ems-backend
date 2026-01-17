require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ems';
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  // import the User model
  const User = require('../dist/models/User').default || require('../src/models/User').default;

  const email = 'admir.sahman@stu.ibu.edu.ba';
  console.log(`Connecting to ${MONGO_URI} and updating role for ${email}...`);

  const user = await User.findOne({ email }).exec();
  if (!user) {
    console.error(`User with email ${email} not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('Before:', { email: user.email, role: user.role });

  user.role = 'admin';
  await user.save();

  const updated = await User.findOne({ email }).exec();
  console.log('After:', { email: updated.email, role: updated.role });

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(2);
});