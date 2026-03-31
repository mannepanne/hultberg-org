// ABOUT: Migration script for importing historical /now page snapshots
// ABOUT: Extracts content from HTML files and imports via API with custom dates

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Snapshot files with their dates (YYYYMMDD format)
const snapshots = [
  { date: '20160926', file: 'index_20160926.CHANGED.html' },
  { date: '20170521', file: 'index_20170521.CHANGED.html' },
  { date: '20170801', file: 'index_20170801.CHANGED.html' },
  { date: '20180727', file: 'index_20180727.CHANGED.html' },
  { date: '20190326', file: 'index_20190326.CHANGED.html' },
  { date: '20211124', file: 'index_20211124.CHANGED.html' },
  { date: '20220202', file: 'index_20220202.CHANGED.html' },
  { date: '20241125', file: 'index_20241125.CHANGED.html' },
  { date: '20250214', file: 'index_20250214.CHANGED.html' }
];

/**
 * Extract text content from HTML element (simplified HTML to text converter)
 */
function htmlToMarkdown(html) {
  // Remove the header link if present
  html = html.replace(/<o>\(<a href="[^"]*">hultberg\.org<\/a>\)/g, '');

  // Convert headings
  html = html.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  html = html.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');

  // Convert paragraphs
  html = html.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');

  // Convert links - remove onclick handlers
  html = html.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Convert strong/bold
  html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  html = html.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');

  // Convert em/italic
  html = html.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  html = html.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Convert unordered lists
  html = html.replace(/<ul[^>]*>/gi, '\n');
  html = html.replace(/<\/ul>/gi, '\n\n');
  html = html.replace(/\s*<li[^>]*>(.*?)<\/li>/gi, '\n- $1');

  // Remove remaining HTML tags
  html = html.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  html = html.replace(/&amp;/g, '&');
  html = html.replace(/&lt;/g, '<');
  html = html.replace(/&gt;/g, '>');
  html = html.replace(/&quot;/g, '"');
  html = html.replace(/&#39;/g, "'");
  html = html.replace(/&nbsp;/g, ' ');

  // Clean up whitespace
  html = html.replace(/\n\s*\n\s*\n/g, '\n\n'); // Max 2 newlines

  // Remove leading whitespace from each line (prevents markdown list continuation)
  html = html.split('\n').map(line => line.trimStart()).join('\n');

  html = html.trim();

  return html;
}

/**
 * Extract main content from HTML file
 */
function extractContent(htmlContent) {
  // Find the content div
  const contentMatch = htmlContent.match(/<div id="content">([\s\S]*?)<\/div>\s*<\/body>/i);
  if (!contentMatch) {
    throw new Error('Could not find content div');
  }

  let content = contentMatch[1];

  // Remove widget sections (Latest snapshot, Reading updates, What I do at Winnow)
  content = content.replace(/<div[^>]*>\s*<h2>(Latest snapshot|Reading updates|What I do at Winnow)<\/h2>[\s\S]*?<\/div>/gi, '');

  // Remove embedded iframes and scripts
  content = content.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
  content = content.replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '');
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[\s\S]*?<\/style>/gi, '');

  // Convert to markdown
  let markdown = htmlToMarkdown(content);

  // Remove the "What I'm doing now" heading if present (it's part of the page template)
  markdown = markdown.replace(/^#\s*What I'm doing now\s*\n\n/i, '');

  return markdown;
}

/**
 * Import a snapshot via API
 */
async function importSnapshot(date, markdown, authToken, origin) {
  const url = `${origin}/admin/api/create-now-snapshot`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `auth_token=${authToken}`,
      'Origin': origin
    },
    body: JSON.stringify({ markdown, date })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to import snapshot ${date}: ${response.status} ${error}`);
  }

  const result = await response.json();
  return result;
}

/**
 * Main migration function
 */
async function migrate() {
  const nowDir = path.join(__dirname, '../public/now');

  console.log('📸 Starting /now snapshots migration\n');
  console.log(`Found ${snapshots.length} snapshots to migrate\n`);

  // Extract and display content from each snapshot
  for (const snapshot of snapshots) {
    const filePath = path.join(nowDir, snapshot.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${snapshot.file}`);
      continue;
    }

    try {
      const htmlContent = fs.readFileSync(filePath, 'utf-8');
      const markdown = extractContent(htmlContent);

      // Format date for display
      const year = snapshot.date.substring(0, 4);
      const month = snapshot.date.substring(4, 6);
      const day = snapshot.date.substring(6, 8);
      const dateStr = `${year}-${month}-${day}`;

      console.log(`\n${'='.repeat(80)}`);
      console.log(`📅 Date: ${dateStr} (${snapshot.date})`);
      console.log(`📄 File: ${snapshot.file}`);
      console.log(`${'='.repeat(80)}\n`);
      console.log(markdown);
      console.log(`\n${'='.repeat(80)}\n`);

      // Store extracted content for API import
      snapshot.markdown = markdown;
    } catch (error) {
      console.error(`❌ Error processing ${snapshot.file}:`, error.message);
    }
  }

  console.log('\n✅ Content extraction complete!');
  console.log('\nTo import these snapshots, you need to:');
  console.log('1. Start the dev server: npm run dev');
  console.log('2. Log in to /admin');
  console.log('3. Run this script with --import flag and provide auth token:');
  console.log('   node scripts/migrate-now-snapshots.js --import --token=<your-jwt-token> --origin=http://localhost:8787\n');
}

/**
 * Import mode - actually send to API
 */
async function importMode() {
  const args = process.argv.slice(2);
  const tokenArg = args.find(arg => arg.startsWith('--token='));
  const originArg = args.find(arg => arg.startsWith('--origin='));

  if (!tokenArg || !originArg) {
    console.error('❌ Missing required arguments: --token and --origin');
    console.error('Usage: node scripts/migrate-now-snapshots.js --import --token=<jwt> --origin=http://localhost:8787');
    process.exit(1);
  }

  const authToken = tokenArg.split('=')[1];
  const origin = originArg.split('=')[1];

  const nowDir = path.join(__dirname, '../public/now');

  console.log('📤 Starting API import mode\n');

  let successCount = 0;
  let errorCount = 0;

  for (const snapshot of snapshots) {
    const filePath = path.join(nowDir, snapshot.file);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${snapshot.file}`);
      errorCount++;
      continue;
    }

    try {
      const htmlContent = fs.readFileSync(filePath, 'utf-8');
      const markdown = extractContent(htmlContent);

      console.log(`📤 Importing snapshot ${snapshot.date}...`);
      const result = await importSnapshot(snapshot.date, markdown, authToken, origin);

      if (result.success) {
        const status = result.overwritten ? 'updated' : 'created';
        console.log(`✅ Snapshot ${snapshot.date} ${status} successfully\n`);
        successCount++;
      } else {
        console.error(`❌ Failed to import ${snapshot.date}: ${result.error}\n`);
        errorCount++;
      }

      // Add small delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`❌ Error importing ${snapshot.file}:`, error.message, '\n');
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`✅ Import complete: ${successCount} successful, ${errorCount} errors`);
  console.log('='.repeat(80) + '\n');
}

// Run migration
const args = process.argv.slice(2);
if (args.includes('--import')) {
  importMode().catch(console.error);
} else {
  migrate().catch(console.error);
}
