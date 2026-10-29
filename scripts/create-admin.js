require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { createInterface } = require('node:readline/promises');
const DATABASE_NAME = 'silvergold_school';
const Admin = mongoose.model('Admin', new mongoose.Schema({ email: { type: String, required: true, unique: true, lowercase: true }, passwordHash: { type: String, required: true } }, { timestamps: true }));
function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== 'function') return reject(new Error('Run this command in a terminal, or set ADMIN_PASSWORD in the environment.'));
    process.stdout.write(prompt);
    input.setRawMode(true); input.resume();
    let value = '';
    const finish = (error, result) => { input.removeListener('data', onData); input.setRawMode(false); process.stdout.write('\n'); error ? reject(error) : resolve(result); };
    const onData = chunk => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003') return finish(new Error('Cancelled.'));
        if (char === '\r' || char === '\n') return finish(null, value);
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    };
    input.on('data', onData);
  });
}
(async () => {
  let email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  let password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    const readline = createInterface({ input: process.stdin, output: process.stdout });
    if (!email) email = (await readline.question('Administrator email: ')).trim().toLowerCase();
    readline.close();
    if (!password) password = await askHidden('Administrator password (input hidden): ');
  }
  if (!process.env.MONGODB_URI || !email || !password) throw new Error('Set MONGODB_URI, ADMIN_EMAIL, and ADMIN_PASSWORD in the environment before running this command.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters.');
  await mongoose.connect(process.env.MONGODB_URI, { dbName: DATABASE_NAME });
  const passwordHash = await bcrypt.hash(password, 12);
  await Admin.updateOne({ email }, { $set: { passwordHash } }, { upsert: true, runValidators: true });
  console.log(`Administrator ${email} is ready.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
