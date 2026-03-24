/**
 * Local file storage - drop-in replacement for S3 in local development.
 * Reads/writes JSON files to a local data/ directory.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

/**
 * Ensure the data directory and any subdirectories exist
 */
function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read JSON from local file
 * @param {string} key - S3-style key (e.g., 'boards.json' or 'sprints/123.json')
 * @returns {object|null} Parsed JSON or null if not found
 */
function readFromStorage(key) {
  const filePath = path.join(DATA_DIR, key);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Write JSON to local file
 * @param {string} key - S3-style key
 * @param {object} data - Data to write
 */
function writeToStorage(key, data) {
  const filePath = path.join(DATA_DIR, key);
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Wrote ${key} to local storage`);
}

/**
 * List JSON files in a subdirectory of storage
 * @param {string} dir - Subdirectory name (e.g., 'people')
 * @returns {string[]} Array of filenames (without path)
 */
function listStorageFiles(dir) {
  const dirPath = path.join(DATA_DIR, dir);
  try {
    return fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

module.exports = {
  readFromStorage,
  writeToStorage,
  listStorageFiles,
  DATA_DIR
};
