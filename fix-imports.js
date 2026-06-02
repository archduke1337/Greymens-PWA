const fs = require('fs');
const path = require('path');

// Find all .tsx files
function findTsxFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
      files.push(...findTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

const root = process.cwd();
const tsxFiles = findTsxFiles(path.join(root, 'app'));
tsxFiles.push(...findTsxFiles(path.join(root, 'components')));

let modifiedCount = 0;
let totalReplacements = 0;

for (const filePath of tsxFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  // Replace all imports from @heroui/react with @/components/compat
  content = content.replace(/from\s+["']@heroui\/react["']/g, 'from "@/components/compat"');
  
  if (content !== original) {
    // Count replacements
    const matches = original.match(/from\s+["']@heroui\/react["']/g);
    totalReplacements += matches ? matches.length : 0;
    modifiedCount++;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modified: ${path.relative(root, filePath)}`);
  }
}

console.log(`\nDone! Modified ${modifiedCount} files with ${totalReplacements} import replacements.`);
