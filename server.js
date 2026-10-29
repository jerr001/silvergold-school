require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const prod = process.env.NODE_ENV === 'production';
const publicDir = path.join(__dirname);
const schemas = {
  Admin: new mongoose.Schema({ email: { type: String, required: true, unique: true, lowercase: true, trim: true }, passwordHash: { type: String, required: true } }, { timestamps: true }),
  News: new mongoose.Schema({ title: { type: String, required: true, maxlength: 160 }, slug: { type: String, required: true, unique: true }, excerpt: { type: String, maxlength: 500, default: '' }, content: { type: String, required: true, maxlength: 20000 }, imageUrl: { type: String, default: '' }, category: { type: String, maxlength: 80, default: 'Announcement' }, publishedAt: { type: Date, default: Date.now }, status: { type: String, enum: ['draft', 'published'], default: 'draft' } }, { timestamps: true }),
  Gallery: new mongoose.Schema({ title: { type: String, maxlength: 160, default: '' }, caption: { type: String, maxlength: 500, default: '' }, category: { type: String, maxlength: 80, default: 'School Events' }, url: { type: String, required: true }, publicId: { type: String, default: '' }, published: { type: Boolean, default: true } }, { timestamps: true }),
  Video: new mongoose.Schema({ title: { type: String, required: true, maxlength: 160 }, description: { type: String, maxlength: 1000, default: '' }, category: { type: String, maxlength: 80, default: 'School Events' }, url: { type: String, required: true }, thumbnailUrl: { type: String, default: '' }, publicId: { type: String, default: '' }, published: { type: Boolean, default: false } }, { timestamps: true }),
  PageContent: new mongoose.Schema({ page: { type: String, required: true, unique: true }, values: { type: mongoose.Schema.Types.Mixed, default: {} } }, { timestamps: true }),
  Admission: new mongoose.Schema({ reference: { type: String, unique: true }, studentName: { type: String, required: true, maxlength: 120 }, dateOfBirth: { type: Date, required: true }, gender: { type: String, maxlength: 40, default: '' }, yearGroup: { type: String, required: true, maxlength: 80 }, currentSchool: { type: String, maxlength: 160, default: '' }, guardianName: { type: String, required: true, maxlength: 120 }, relationship: { type: String, maxlength: 80, default: '' }, phone: { type: String, required: true, maxlength: 40 }, email: { type: String, required: true, lowercase: true, maxlength: 254 }, address: { type: String, maxlength: 500, default: '' }, message: { type: String, maxlength: 2000, default: '' }, status: { type: String, enum: ['new', 'reviewing', 'accepted', 'declined'], default: 'new' } }, { timestamps: true }),
  Contact: new mongoose.Schema({ name: { type: String, required: true, maxlength: 120 }, email: { type: String, required: true, lowercase: true, maxlength: 254 }, message: { type: String, required: true, maxlength: 5000 }, status: { type: String, enum: ['unread', 'read', 'archived'], default: 'unread' } }, { timestamps: true }),
  Feedback: new mongoose.Schema({ parentName: { type: String, required: true, maxlength: 120 }, email: { type: String, required: true, lowercase: true, maxlength: 254 }, phone: { type: String, maxlength: 40, default: '' }, studentName: { type: String, maxlength: 120, default: '' }, className: { type: String, maxlength: 80, default: '' }, category: { type: String, required: true, enum: ['Feedback', 'Suggestion', 'Concern', 'Compliment'] }, subject: { type: String, required: true, maxlength: 160 }, message: { type: String, required: true, maxlength: 5000 }, status: { type: String, enum: ['unread', 'read', 'archived'], default: 'unread' } }, { timestamps: true })
};
const models = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, mongoose.models[name] || mongoose.model(name, schema)]));
const DATABASE_NAME = 'silvergold_school';
const legacyGalleryAssets = Array.from({ length: 8 }, (_, index) => ({ title: `School Gallery ${index + 1}`, caption: `Silvergold school photo ${index + 1}`, url: index === 0 ? '/images/hero-image.jpg' : `/images/image-${index}.jpg` }));
async function seedLegacyGalleryAssets() {
  const markerPage = '__gallery_assets_seed_v1__';
  if (await models.PageContent.exists({ page: markerPage })) {
    for (const asset of legacyGalleryAssets) await models.Gallery.updateOne({ url: asset.url.slice(1) }, { $set: { url: asset.url } });
    return;
  }
  for (const asset of legacyGalleryAssets) await models.Gallery.updateOne({ url: asset.url }, { $setOnInsert: { ...asset, category: 'School Events', published: true } }, { upsert: true });
  await models.PageContent.updateOne({ page: markerPage }, { $setOnInsert: { values: { complete: 'true' } } }, { upsert: true });
}


app.disable('x-powered-by');
if (prod) app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], scriptSrc: ["'self'"], imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'], mediaSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'], frameSrc: ['https://www.google.com'], connectSrc: ["'self'"] } } }));
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(session({ name: 'sg.sid', secret: process.env.SESSION_SECRET || 'development-only-change-this-session-secret-now', resave: false, saveUninitialized: false, store: process.env.MONGODB_URI ? MongoStore.create({ mongoUrl: process.env.MONGODB_URI, dbName: DATABASE_NAME, collectionName: 'sessions', ttl: 60 * 60 * 8 }) : undefined, cookie: { httpOnly: true, secure: prod, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 } }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many sign-in attempts. Please try again later.' } });
const publicLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 15, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many submissions. Please try again later.' } });
function adminOnly(req, res, next) { if (!req.session.adminId) return res.status(401).json({ error: 'Please sign in.' }); next(); }
function csrf(req, res, next) { if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next(); if (!req.session.csrfToken || req.get('x-csrf-token') !== req.session.csrfToken) return res.status(403).json({ error: 'Your session expired. Refresh and try again.' }); next(); }
function clean(value, max = 5000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function safePageValue(key, value) { if (key.startsWith('href-')) return /^(?:https?:\/\/[^\s]+|mailto:[^\s]+|tel:[0-9+(). -]+|\/(?!\/)[^\s]*|#[\w-]*|[a-z0-9][\w./?=&%+-]*)$/i.test(value); if (key.startsWith('image-')) return /^(?:https:\/\/[^\s]+|\/(?!\/)[^\s]*|[a-z0-9][\w./-]*(?:\?[^\s]*)?)$/i.test(value); return true; }
function emailValid(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function slugify(value) { return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140) || 'article'; }
async function uniqueSlug(title, skipId) { const root = slugify(title); let slug = root; let suffix = 2; while (await models.News.exists({ slug, ...(skipId ? { _id: { $ne: skipId } } : {}) })) slug = `${root}-${suffix++}`; return slug; }
function safeNews(doc) { const item = doc.toObject ? doc.toObject() : doc; delete item.__v; return item; }

app.get('/api/health', (_req, res) => res.json({ ok: mongoose.connection.readyState === 1 }));
const contentPages = new Set(['index', 'about', 'academics', 'admissions', 'contact', 'feedback', 'gallery', 'news']);
app.get('/api/content/:page', async (req, res, next) => { try { if (!contentPages.has(req.params.page)) return res.status(404).json({ error: 'Page content not found.' }); const page = await models.PageContent.findOne({ page: req.params.page }).lean(); res.json({ values: page?.values || {} }); } catch (e) { next(e); } });
app.post('/api/admin/login', loginLimiter, async (req, res, next) => {
  try { const email = clean(req.body.email, 254).toLowerCase(); const password = typeof req.body.password === 'string' ? req.body.password : ''; const admin = await models.Admin.findOne({ email }); if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' }); req.session.regenerate(err => { if (err) return next(err); req.session.adminId = admin.id; req.session.adminEmail = admin.email; req.session.csrfToken = require('crypto').randomBytes(32).toString('hex'); res.json({ ok: true, csrfToken: req.session.csrfToken }); }); } catch (e) { next(e); }
});
app.get('/api/admin/me', adminOnly, (req, res) => res.json({ email: req.session.adminEmail || '', csrfToken: req.session.csrfToken }));
app.post('/api/admin/logout', adminOnly, csrf, (req, res, next) => req.session.destroy(err => { if (err) return next(err); res.clearCookie('sg.sid', { httpOnly: true, secure: prod, sameSite: 'strict' }); res.json({ ok: true }); }));
app.use('/api/admin', adminOnly, csrf);
app.get('/api/admin/content', async (req, res, next) => { try { const pageName = req.query.page; if (!contentPages.has(pageName)) return res.status(400).json({ error: 'Choose a valid website page.' }); const page = await models.PageContent.findOne({ page: pageName }).lean(); res.json({ page: pageName, values: page?.values || {} }); } catch (e) { next(e); } });
app.put('/api/admin/content', async (req, res, next) => { try { const { page: pageName, values } = req.body || {}; if (!contentPages.has(pageName) || !values || typeof values !== 'object' || Array.isArray(values)) return res.status(400).json({ error: 'Choose a valid page and provide its content.' }); const entries = Object.entries(values); if (entries.length > 600 || entries.some(([key, value]) => !/^(page-title|text|alt|placeholder|titleattr|aria|href|image)(?:-\d+)?$/.test(key) || typeof value !== 'string' || value.length > 5000 || !safePageValue(key, value))) return res.status(400).json({ error: 'Some content fields are invalid, unsafe, or too long.' }); const doc = await models.PageContent.findOneAndUpdate({ page: pageName }, { $set: { values: Object.fromEntries(entries) } }, { new: true, upsert: true, runValidators: true }).lean(); res.json({ page: pageName, values: doc.values || {} }); } catch (e) { next(e); } });

app.get('/api/news', async (_req, res, next) => { try { res.json(await models.News.find({ status: 'published', publishedAt: { $lte: new Date() } }).select('title slug excerpt imageUrl category publishedAt').sort({ publishedAt: -1 }).limit(50).lean()); } catch (e) { next(e); } });
app.get('/api/news/:slug', async (req, res, next) => { try { const item = await models.News.findOne({ slug: req.params.slug, status: 'published', publishedAt: { $lte: new Date() } }).lean(); if (!item) return res.status(404).json({ error: 'Article not found.' }); res.json(item); } catch (e) { next(e); } });
app.get('/api/gallery', async (_req, res, next) => { try { res.json(await models.Gallery.find({ published: true }).select('title caption category url createdAt').sort({ createdAt: -1 }).limit(100).lean()); } catch (e) { next(e); } });
app.get('/api/videos', async (_req, res, next) => { try { res.json(await models.Video.find({ published: true }).select('title description category url thumbnailUrl createdAt').sort({ createdAt: -1 }).limit(50).lean()); } catch (e) { next(e); } });

app.post('/api/admissions', publicLimiter, async (req, res, next) => {
  try { const b = req.body; if (clean(b.website, 200)) return res.status(400).json({ error: 'Unable to submit this application.' }); const fields = { studentName: clean(b.studentName, 120), dateOfBirth: b.dateOfBirth, gender: clean(b.gender, 40), yearGroup: clean(b.yearGroup, 80), currentSchool: clean(b.currentSchool, 160), guardianName: clean(b.guardianName, 120), relationship: clean(b.relationship, 80), phone: clean(b.phone, 40), email: clean(b.email, 254).toLowerCase(), address: clean(b.address, 500), message: clean(b.message, 2000) }; if (!fields.studentName || !fields.dateOfBirth || !fields.yearGroup || !fields.guardianName || !fields.phone || !emailValid(fields.email) || Number.isNaN(Date.parse(fields.dateOfBirth)) || new Date(fields.dateOfBirth) >= new Date()) return res.status(400).json({ error: 'Please complete all required fields with valid details.' }); fields.reference = `SG-${new Date().getFullYear()}-${require('crypto').randomBytes(4).toString('hex').toUpperCase()}`; const item = await models.Admission.create(fields); res.status(201).json({ ok: true, reference: item.reference }); } catch (e) { next(e); }
});
app.post('/api/contact', publicLimiter, async (req, res, next) => { try { const b = req.body; const name = clean(b.name, 120), email = clean(b.email, 254).toLowerCase(), message = clean(b.message, 5000); if (!name || !emailValid(email) || message.length < 5) return res.status(400).json({ error: 'Please enter your name, a valid email, and a message.' }); await models.Contact.create({ name, email, message }); res.status(201).json({ ok: true, message: 'Thank you. We have received your message. Please check your email address for a response.' }); } catch (e) { next(e); } });
app.post('/api/feedback', publicLimiter, async (req, res, next) => { try { const b = req.body || {}; const fields = { parentName: clean(b.parentName, 120), email: clean(b.email, 254).toLowerCase(), phone: clean(b.phone, 40), studentName: clean(b.studentName, 120), className: clean(b.className, 80), category: clean(b.category, 40), subject: clean(b.subject, 160), message: clean(b.message, 5000) }; if (!fields.parentName || !emailValid(fields.email) || !['Feedback', 'Suggestion', 'Concern', 'Compliment'].includes(fields.category) || !fields.subject || fields.message.length < 5) return res.status(400).json({ error: 'Please complete your name, a valid email, type, subject, and message.' }); await models.Feedback.create(fields); res.status(201).json({ ok: true, message: 'Thank you for sharing this with us. We have received your message. Please check your email address for a response.' }); } catch (e) { next(e); } });

app.get('/api/admin/dashboard', async (_req, res, next) => { try { const [news, gallery, videos, applications, unreadMessages, pendingApplications, recentAdmissions, recentMessages] = await Promise.all([models.News.countDocuments({ status: 'published' }), models.Gallery.countDocuments({ published: true }), models.Video.countDocuments({ published: true }), models.Admission.countDocuments(), models.Contact.countDocuments({ status: 'unread' }), models.Admission.countDocuments({ status: 'new' }), models.Admission.find().sort({ createdAt: -1 }).limit(5).select('reference studentName yearGroup status createdAt').lean(), models.Contact.find().sort({ createdAt: -1 }).limit(5).select('name email message status createdAt').lean()]); res.json({ news, gallery, videos, applications, unreadMessages, pendingApplications, recentAdmissions, recentMessages }); } catch (e) { next(e); } });
function adminCollection(model, opts = {}) {
  return async (req, res, next) => { try { const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1); const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50)); const filter = {}; if (req.query.q) { const q = clean(req.query.q, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (opts.search === 'studentName') filter.$or = ['studentName', 'guardianName', 'reference', 'email'].map(field => ({ [field]: { $regex: q, $options: 'i' } })); else if (opts.search === 'name') filter.$or = ['name', 'email'].map(field => ({ [field]: { $regex: q, $options: 'i' } })); else filter[opts.search || 'title'] = { $regex: q, $options: 'i' }; } if (req.query.status && opts.status) filter[opts.status] = req.query.status; if (req.query.category && opts.category) filter.category = clean(req.query.category, 80); const [items, total] = await Promise.all([model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), model.countDocuments(filter)]); res.json({ items, total, page, pages: Math.ceil(total / limit) }); } catch (e) { next(e); } };
}
app.get('/api/admin/news', adminCollection(models.News, { search: 'title', status: 'status' }));
app.post('/api/admin/news', async (req, res, next) => { try { const b = req.body; const title = clean(b.title, 160), content = clean(b.content, 20000); if (!title || !content) return res.status(400).json({ error: 'Headline and article content are required.' }); const item = await models.News.create({ title, slug: await uniqueSlug(title), content, excerpt: clean(b.excerpt, 500), imageUrl: clean(b.imageUrl, 1000), category: clean(b.category, 80) || 'Announcement', publishedAt: b.publishedAt && !Number.isNaN(Date.parse(b.publishedAt)) ? new Date(b.publishedAt) : new Date(), status: b.status === 'published' ? 'published' : 'draft' }); res.status(201).json(item); } catch (e) { next(e); } });
app.patch('/api/admin/news/:id', async (req, res, next) => { try { const item = await models.News.findById(req.params.id); if (!item) return res.status(404).json({ error: 'Article not found.' }); const b = req.body; for (const key of ['title', 'excerpt', 'content', 'imageUrl', 'category']) if (b[key] !== undefined) item[key] = clean(b[key], key === 'content' ? 20000 : key === 'excerpt' ? 500 : key === 'imageUrl' ? 1000 : key === 'title' ? 160 : 80); if (b.status !== undefined) item.status = b.status === 'published' ? 'published' : 'draft'; if (b.publishedAt && !Number.isNaN(Date.parse(b.publishedAt))) item.publishedAt = new Date(b.publishedAt); if (b.title) item.slug = await uniqueSlug(item.title, item.id); await item.save(); res.json(item); } catch (e) { next(e); } });
app.delete('/api/admin/news/:id', async (req, res, next) => { try { const item = await models.News.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ error: 'Article not found.' }); res.json({ ok: true }); } catch (e) { next(e); } });
async function storeCloud(file, type) {
  const resourceType = type === 'video' ? 'video' : 'image';
  const folder = `silvergold/${type === 'video' ? 'videos' : 'gallery'}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`).digest('hex');
  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: file.mimetype }), path.basename(file.originalname));
  form.append('api_key', process.env.CLOUDINARY_API_KEY); form.append('timestamp', String(timestamp)); form.append('folder', folder); form.append('signature', signature);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/${resourceType}/upload`, { method: 'POST', body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || 'Media storage rejected the upload.');
  return result;
}
async function removeCloud(publicId, type = 'image') {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash('sha1').update(`public_id=${publicId}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`).digest('hex');
  const form = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: process.env.CLOUDINARY_API_KEY, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(process.env.CLOUDINARY_CLOUD_NAME)}/${type}/destroy`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  if (!response.ok) throw new Error('Media storage rejected the delete request.');
}
app.post('/api/admin/uploads/image', multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.MAX_IMAGE_MB || 8) * 1024 * 1024, files: 1 } }).single('file'), async (req, res, next) => {
  try {
    const file = req.file, b = file?.buffer;
    const signatureValid = b && ((file.mimetype === 'image/jpeg' && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) || (file.mimetype === 'image/png' && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || (file.mimetype === 'image/webp' && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP')));
    if (!file || !signatureValid) return res.status(400).json({ error: 'Choose a valid JPEG, PNG, or WebP image.' });
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ error: 'Media storage is not configured.' });
    const stored = await storeCloud(file, 'image'); res.status(201).json({ url: stored.secure_url });
  } catch (e) { next(e); }
});
function mediaUpload(type) {
  const video = type === 'video';
  const max = Number(process.env[video ? 'MAX_VIDEO_MB' : 'MAX_IMAGE_MB'] || (video ? 100 : 8)) * 1024 * 1024;
  const receive = multer({ storage: multer.memoryStorage(), limits: { fileSize: max, files: video ? 1 : 10 } }).array(video ? 'file' : 'files', video ? 1 : 10);
  function validSignature(file) {
    const b = file.buffer;
    if (file.mimetype === 'image/jpeg') return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    if (file.mimetype === 'image/png') return b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    if (file.mimetype === 'image/webp') return b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    if (file.mimetype === 'video/webm') return b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (['video/mp4', 'video/quicktime'].includes(file.mimetype)) return b.toString('ascii', 4, 8) === 'ftyp';
    return false;
  }
  return [receive, async (req, res, next) => {
    try {
      if (!req.files?.length) return res.status(400).json({ error: 'Choose a file to upload.' });
      const allowed = video ? ['video/mp4', 'video/webm', 'video/quicktime'] : ['image/jpeg', 'image/png', 'image/webp'];
      if (req.files.some(file => !allowed.includes(file.mimetype) || file.size > max || !validSignature(file))) return res.status(400).json({ error: video ? 'Choose a valid MP4, WebM, or MOV video within the upload limit.' : 'Choose valid JPEG, PNG, or WebP images within the upload limit.' });
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return res.status(503).json({ error: 'Media storage is not configured. Add Cloudinary credentials to the server environment.' });
      const saved = [];
      for (const file of req.files) {
        const stored = await storeCloud(file, video ? 'video' : 'image');
        if (video) saved.push(await models.Video.create({ title: clean(req.body.title, 160) || file.originalname.slice(0, 150), description: clean(req.body.description, 1000), category: clean(req.body.category, 80) || 'School Events', url: stored.secure_url, thumbnailUrl: clean(req.body.thumbnailUrl, 1000), publicId: stored.public_id, published: req.body.published === 'true' }));
        else saved.push(await models.Gallery.create({ title: clean(req.body.title, 160) || file.originalname.slice(0, 150), caption: clean(req.body.caption, 500), category: clean(req.body.category, 80) || 'School Events', url: stored.secure_url, publicId: stored.public_id, published: req.body.published !== 'false' }));
      }
      res.status(201).json(video ? saved[0] : saved);
    } catch (e) { next(e); }
  }];
}
app.get('/api/admin/gallery', adminCollection(models.Gallery, { search: 'title', category: true }));
app.post('/api/admin/gallery', ...mediaUpload('image'));
app.patch('/api/admin/gallery/:id', async (req, res, next) => { try { const item = await models.Gallery.findById(req.params.id); if (!item) return res.status(404).json({ error: 'Image not found.' }); for (const key of ['title', 'caption', 'category']) if (req.body[key] !== undefined) item[key] = clean(req.body[key], key === 'caption' ? 500 : 160); if (req.body.url !== undefined) { const url = clean(req.body.url, 1000); if (!/^(?:https:\/\/[^\s]+|\/(?!\/)[^\s]*|[a-z0-9][\w./-]*)$/i.test(url)) return res.status(400).json({ error: 'Use an HTTPS image URL or a site-relative image path.' }); item.url = url; } if (req.body.published !== undefined) item.published = Boolean(req.body.published); await item.save(); res.json(item); } catch (e) { next(e); } });
app.delete('/api/admin/gallery/:id', async (req, res, next) => { try { const item = await models.Gallery.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ error: 'Image not found.' }); if (item.publicId && process.env.CLOUDINARY_API_SECRET) await removeCloud(item.publicId); res.json({ ok: true }); } catch (e) { next(e); } });
app.get('/api/admin/videos', adminCollection(models.Video, { search: 'title', category: true }));
app.post('/api/admin/videos', ...mediaUpload('video'));
app.patch('/api/admin/videos/:id', async (req, res, next) => { try { const item = await models.Video.findById(req.params.id); if (!item) return res.status(404).json({ error: 'Video not found.' }); for (const key of ['title', 'description', 'category', 'thumbnailUrl']) if (req.body[key] !== undefined) item[key] = clean(req.body[key], 1000); if (req.body.published !== undefined) item.published = Boolean(req.body.published); await item.save(); res.json(item); } catch (e) { next(e); } });
app.delete('/api/admin/videos/:id', async (req, res, next) => { try { const item = await models.Video.findByIdAndDelete(req.params.id); if (!item) return res.status(404).json({ error: 'Video not found.' }); if (item.publicId && process.env.CLOUDINARY_API_SECRET) await removeCloud(item.publicId, 'video'); res.json({ ok: true }); } catch (e) { next(e); } });
app.get('/api/admin/admissions', adminCollection(models.Admission, { search: 'studentName', status: 'status' }));
app.patch('/api/admin/admissions/:id', async (req, res, next) => { try { const item = await models.Admission.findById(req.params.id); if (!item) return res.status(404).json({ error: 'Application not found.' }); if (['new', 'reviewing', 'accepted', 'declined'].includes(req.body.status)) item.status = req.body.status; await item.save(); res.json(item); } catch (e) { next(e); } });
app.get('/api/admin/contact', adminCollection(models.Contact, { search: 'name', status: 'status' }));
app.patch('/api/admin/contact/:id', async (req, res, next) => { try { const item = await models.Contact.findById(req.params.id); if (!item) return res.status(404).json({ error: 'Message not found.' }); if (['unread', 'read', 'archived'].includes(req.body.status)) item.status = req.body.status; await item.save(); res.json(item); } catch (e) { next(e); } });
app.get('/api/admin/feedback', adminCollection(models.Feedback, { search: 'parentName', status: 'status' }));
app.patch('/api/admin/feedback/:id', async (req, res, next) => { try { const item = await models.Feedback.findById(req.params.id); if (!item) return res.status(404).json({ error: 'Feedback message not found.' }); if (['unread', 'read', 'archived'].includes(req.body.status)) item.status = req.body.status; await item.save(); res.json(item); } catch (e) { next(e); } });
app.get('/api/admin/export/:collection', async (req, res, next) => { try { const Model = req.params.collection === 'admissions' ? models.Admission : req.params.collection === 'contact' ? models.Contact : req.params.collection === 'feedback' ? models.Feedback : null; if (!Model) return res.status(404).json({ error: 'Export not available.' }); const records = await Model.find().sort({ createdAt: -1 }).lean(); const keys = Object.keys(Model.schema.paths).filter(k => !['_id', '__v'].includes(k)); const quote = v => { let value = String(v ?? ''); if (/^[=+@\-\t\r]/.test(value)) value = `'${value}`; return `"${value.replace(/"/g, '""')}"`; }; const csv = [keys.join(','), ...records.map(row => keys.map(key => quote(row[key])).join(','))].join('\r\n'); res.type('text/csv').attachment(`${req.params.collection}.csv`).send(csv); } catch (e) { next(e); } });

app.use((req, res, next) => { if (/^\/(?:server\.js|package\.json|README\.md|\.env(?:\..*)?|scripts(?:\/|$)|\.git(?:\/|$))/i.test(req.path)) return res.sendStatus(404); next(); });
app.use(express.static(publicDir, { index: 'index.html', dotfiles: 'ignore' }));
app.get('/admin', (_req, res) => res.redirect('/admin/'));
app.use((err, _req, res, _next) => { console.error(err.message); if (err instanceof multer.MulterError) return res.status(400).json({ error: 'The upload exceeded the configured size limit.' }); if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid record identifier.' }); if (err.code === 11000) return res.status(409).json({ error: 'A record with those details already exists.' }); if (err.name === 'MongooseServerSelectionError' || mongoose.connection.readyState !== 1) return res.status(503).json({ error: 'The school database is temporarily unreachable, so your message was not saved. Please try again later or contact the school directly.' }); res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong. Please try again.' }); });

async function start() { if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured before starting the application.'); if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('Set SESSION_SECRET to a random value of at least 32 characters.'); await mongoose.connect(process.env.MONGODB_URI, { dbName: DATABASE_NAME }); await seedLegacyGalleryAssets(); app.listen(PORT, () => console.log(`Silvergold site listening on port ${PORT}`)); }
if (require.main === module) start().catch(err => { console.error(err.message); process.exit(1); });
module.exports = app;
