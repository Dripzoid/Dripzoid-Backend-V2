import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

async function configureAtlas() {
  const credsPath = process.env.ATLAS_CREDENTIALS_PATH ||
    (fs.existsSync('atlas-credentials.env') ? 'atlas-credentials.env' : 'C:\\Users\\yuvat\\Downloads\\atlas-credentials.env');
  if (!fs.existsSync(credsPath)) {
    throw new Error('atlas-credentials.env not found at ' + credsPath);
  }

  const raw = fs.readFileSync(credsPath, 'utf-8');
  const parsed = dotenv.parse(raw);

  let mongoUri = parsed.MONGODB_URI;
  const username = parsed.MONGODB_USERNAME;
  const password = parsed.MONGODB_PASSWORD;

  if (!mongoUri) {
    throw new Error('MONGODB_URI not found in atlas-credentials.env');
  }

  if (username && password) {
    mongoUri = mongoUri.replace('<username>', encodeURIComponent(username));
    mongoUri = mongoUri.replace('<password>', encodeURIComponent(password));
  }

  const urlObj = new URL(mongoUri);
  urlObj.pathname = '/dripzoid';

  const databaseUrl = urlObj.toString();

  const envContent = [
    `# Database Configuration`,
    `DATABASE_URL="${databaseUrl}"`,
    `PORT=5000`,
    `NODE_ENV=development`,
    `JWT_SECRET=dripzoid_jwt_secret_key_development_2026`,
    `SESSION_SECRET=dripzoid_session_secret_key_development_2026`,
    ``
  ].join('\n');

  const targetEnv = path.resolve(process.cwd(), '.env');
  fs.writeFileSync(targetEnv, envContent, { encoding: 'utf-8' });
  console.log('✅ .env file created successfully in project root.');

  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaClient();

  try {
    console.log('Testing Atlas connection via Prisma...');
    await prisma.$connect();
    console.log('✅ Prisma connected to MongoDB Atlas successfully!');
    
    const userCount = await prisma.user.count();
    console.log(`Current user count in MongoDB Atlas: ${userCount}`);
    
    await prisma.$disconnect();
  } catch (err) {
    console.error('❌ Connection test failed:', err.message);
    throw err;
  }
}

configureAtlas().catch((err) => {
  console.error('Fatal error configuring Atlas:', err.message);
  process.exit(1);
});
