const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const pages = [
  'index.html',
  'about.html',
  'academics.html',
  'admissions.html',
  'contact.html',
  'feedback.html',
  'gallery.html',
  'news.html'
];
const publicExtensions = new Set(['.html', '.css', '.js', '.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.ico']);

function copyPublicFiles(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyPublicFiles(from, to);
    } else if (publicExtensions.has(path.extname(entry.name).toLowerCase())) {
      fs.copyFileSync(from, to);
    }
  }
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const page of pages) fs.copyFileSync(path.join(root, page), path.join(output, page));
for (const folder of ['admin', 'css', 'images', 'js']) {
  copyPublicFiles(path.join(root, folder), path.join(output, folder));
}
console.log(`Prepared static Netlify site in ${path.relative(root, output)}.`);
