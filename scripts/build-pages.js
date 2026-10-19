const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pagesDirectory = path.join(root, 'pages');
const outputDirectory = path.join(root, '_site');

fs.rmSync(outputDirectory, { recursive: true, force: true });
fs.cpSync(pagesDirectory, outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, '.nojekyll'), '');