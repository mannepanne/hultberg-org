// ABOUT: Build-time script that regenerates public/updates/data/index.json
// ABOUT: Reads all individual update JSON files and writes a lightweight index of published updates

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../public/updates/data');
const INDEX_FILE = path.join(DATA_DIR, 'index.json');

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'index.json');

const updates = files
  .map(file => {
    try {
      return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
    } catch (err) {
      console.error(`Skipping ${file} — parse error: ${err.message}`);
      return null;
    }
  })
  .filter(u => u !== null && u.status === 'published' && u.publishedDate)
  .map(u => ({
    slug: u.slug,
    title: u.title,
    excerpt: u.excerpt || '',
    publishedDate: u.publishedDate,
    status: u.status,
  }))
  .sort((a, b) => new Date(b.publishedDate) - new Date(a.publishedDate));

fs.writeFileSync(INDEX_FILE, JSON.stringify({ updates }, null, 2) + '\n');

console.log(`generate-index: wrote ${updates.length} published update(s) to index.json`);
