require('dotenv').config();
const mongoose = require('mongoose');

function getArg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/ems';

  const emailRaw =
    process.env.SUPER_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    getArg('email') ||
    process.argv[2];

  const password =
    process.env.SUPER_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    getArg('password');

  const name =
    process.env.SUPER_ADMIN_NAME ||
    process.env.ADMIN_NAME ||
    getArg('name') ||
    'Super Admin';

  if (!emailRaw) {
    console.error('Missing email. Provide SUPER_ADMIN_EMAIL/ADMIN_EMAIL or --email <email>.');
    process.exit(1);
  }

  const email = String(emailRaw).trim().toLowerCase();
  if (!email || !email.includes('@')) {
    console.error('Invalid email.');
    process.exit(1);
  }

  let User;
  try {
    // Requires a built backend (dist/). This avoids relying on ts-node in production.
    User = require('../dist/models/User').default;
  } catch (err) {
    console.error('Cannot load dist/models/User. Run "npm run build" first.');
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log(`Connected. Ensuring admin user exists for ${email}...`);

  let user = await User.findOne({ email }).exec();

  if (!user) {
    if (!password) {
      console.error(
        'User does not exist. Provide SUPER_ADMIN_PASSWORD/ADMIN_PASSWORD or --password <password> to create it.'
      );
      process.exit(1);
    }

    user = await User.create({
      name,
      email,
      password,
      role: 'admin',
    });

    console.log('Created admin user:', { id: String(user._id), email: user.email, role: user.role });
    return;
  }

  const before = { id: String(user._id), email: user.email, role: user.role };

  user.role = 'admin';
  if (password) {
    user.password = password;
  }
  if (name && String(name).trim()) {
    user.name = String(name).trim();
  }
  await user.save();

  const after = { id: String(user._id), email: user.email, role: user.role };
  console.log('Updated admin user:', { before, after, passwordUpdated: Boolean(password) });
}

main()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Error:', err);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    process.exit(2);
  });