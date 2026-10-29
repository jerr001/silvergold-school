require('dotenv').config();
const mongoose = require('mongoose');

async function check() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is empty. Add the Atlas application connection string to .env.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: 'silvergold_school', serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB connection verified for database "${mongoose.connection.name}".`);
}

check().catch(error => {
  const code = error.cause?.code || error.code || 'unknown';
  const safeMessage = String(error.message || 'No error message available.')
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[connection URI hidden]')
    .slice(0, 1400);
  console.error(`Could not connect to MongoDB (${error.name}; ${code}).`);
  console.error(safeMessage);
  process.exitCode = 1;
}).finally(() => mongoose.disconnect());
