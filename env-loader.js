const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envFiles = ['.env', 'ENV5', '.env.txt'];
const loadedFiles = [];

for (const fileName of envFiles) {
    const fullPath = path.resolve(__dirname, fileName);
    if (fs.existsSync(fullPath)) {
        const result = dotenv.config({ path: fullPath, override: false });
        if (result.error) {
            console.error(`Failed to load ${fileName}:`, result.error.message);
        } else {
            loadedFiles.push(fileName);
        }
    }
}

if (loadedFiles.length === 0) {
    console.warn('No .env, ENV5, or .env.txt found. Environment variables may be missing.');
} else {
    console.log(`Loaded environment files: ${loadedFiles.join(', ')}`);
}

module.exports = {
    loadedFiles
};
