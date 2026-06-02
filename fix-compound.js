const fs = require('fs');
const path = require('path');

// Map of compound component patterns to flat component names
const replacements = [
  // Card compound patterns
  ['<Card.Content', '<CardContent'],
  ['</Card.Content>', '</CardContent>'],
  ['<Card.Header', '<CardHeader'],
  ['</Card.Header>', '</CardHeader>'],
  ['<Card.Footer', '<CardFooter'],
  ['</Card.Footer>', '</CardFooter>'],
  // Modal compound patterns
  ['<Modal.Dialog', '<ModalDialog'],
  ['</Modal.Dialog>', '</ModalDialog>'],
  ['<Modal.Header', '<ModalHeader'],
  ['</Modal.Header>', '</ModalHeader>'],
  ['<Modal.Body', '<ModalBody'],
  ['</Modal.Body>', '</ModalBody>'],
  ['<Modal.Footer', '<ModalFooter'],
  ['</Modal.Footer>', '</ModalFooter>'],
  // Select compound patterns
  ['<Select.Item', '<ListBoxItem'],
  ['</Select.Item>', '</ListBoxItem>'],
];

// Also handle closing tag patterns with attributes like <Card.Content className=
// The regex approach: find <Component.SubComponent and replace with <FlatName

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

for (const filePath of tsxFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  
  for (const [old, rep] of replacements) {
    content = content.split(old).join(rep);
  }
  
  if (content !== original) {
    modifiedCount++;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modified: ${path.relative(root, filePath)}`);
  }
}

console.log(`\nDone! Modified ${modifiedCount} files.`);
