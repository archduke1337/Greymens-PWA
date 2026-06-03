const fs = require('fs');
const path = require('path');

function findTsxFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
      files.push(...findTsxFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      files.push(fullPath);
    }
  }
  return files;
}

const root = process.cwd();
const files = findTsxFiles(path.join(root, 'app'));
files.push(...findTsxFiles(path.join(root, 'components')));

let totalModified = 0;

for (const filePath of files) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const rel = path.relative(root, filePath);

  // 1. Fix Chip variant="dot" → variant="primary" (dot not valid in v3)
  content = content.replace(/variant="dot"/g, 'variant="primary"');
  
  // 2. Fix Chip variant="solid" → variant="primary" (on Chip, not Button)
  // Be more careful: only on lines with <Chip
  content = content.replace(/<Chip[^>]*variant="solid"/g, (match) => match.replace('variant="solid"', 'variant="primary"'));
  
  // 3. Fix Chip variant="bordered" → variant="secondary"
  content = content.replace(/<Chip[^>]*variant="bordered"/g, (match) => match.replace('variant="bordered"', 'variant="secondary"'));
  
  // 4. Fix Chip variant="light" → variant="soft"
  content = content.replace(/<Chip[^>]*variant="light"/g, (match) => match.replace('variant="light"', 'variant="soft"'));
  
  // 5. Fix Chip variant="flat" → variant="tertiary"
  content = content.replace(/<Chip[^>]*variant="flat"/g, (match) => match.replace('variant="flat"', 'variant="tertiary"'));
  
  // 6. Fix Chip color="accent" → color="accent" (already correct in v3)
  // But fix color="primary" → color="accent" on Chip only
  content = content.replace(/<Chip[^>]*color="primary"/g, (match) => match.replace('color="primary"', 'color="accent"'));
  
  // 7. Fix Chip color="secondary" → color="default" on Chip only  
  content = content.replace(/<Chip[^>]*color="secondary"/g, (match) => match.replace('color="secondary"', 'color="default"'));

  // 8. Fix Button variant="solid" → variant="primary"
  content = content.replace(/<Button[^>]*variant="solid"/g, (match) => match.replace('variant="solid"', 'variant="primary"'));

  // 9. Fix Button variant="bordered" → variant="secondary"
  content = content.replace(/<Button[^>]*variant="bordered"/g, (match) => match.replace('variant="bordered"', 'variant="secondary"'));

  // 10. Fix Button variant="light" → variant="tertiary"
  content = content.replace(/<Button[^>]*variant="light"/g, (match) => match.replace('variant="light"', 'variant="tertiary"'));
  
  // 11. Fix Button variant="flat" → variant="tertiary"
  content = content.replace(/<Button[^>]*variant="flat"/g, (match) => match.replace('variant="flat"', 'variant="tertiary"'));
  
  // 12. Fix Button variant="faded" → variant="secondary"
  content = content.replace(/<Button[^>]*variant="faded"/g, (match) => match.replace('variant="faded"', 'variant="secondary"'));
  
  // 13. Fix Button variant="shadow" → variant="primary" (use Tailwind for shadow)
  content = content.replace(/<Button[^>]*variant="shadow"/g, (match) => match.replace('variant="shadow"', 'variant="primary"'));

  // 14. Fix Button variant="dot" → variant="primary"
  content = content.replace(/<Button[^>]*variant="dot"/g, (match) => match.replace('variant="dot"', 'variant="primary"'));

  // 15. Fix AccordionItem variant="outline" → variant="default"
  // Already handled in previous script

  // 16. Fix Accordion variant="outline" → variant="default"
  content = content.replace(/<Accordion[^>]*variant="outline"/g, (match) => match.replace('variant="outline"', 'variant="default"'));

  // 17. Remove Accordion selectionMode prop (not in v3, use allowsMultipleExpanded)
  content = content.replace(/\s+selectionMode="multiple"/g, ' allowsMultipleExpanded');

  // 18. Fix AccordionItem key → id (keep React key)
  // This is tricky - key is React reconciliation, id is for Accordion state
  // We'll add id="..." alongside key="..."

  // 19. Fix Switch: onValueChange → onChange (already done in prev script)
  // isBordered on Switch → remove
  content = content.replace(/<Switch[^>]*isBordered/g, (match) => match.replace(/\s+isBordered/g, ''));

  // 20. Fix Avatar: isBordered → remove (use Tailwind)
  content = content.replace(/<Avatar[^>]*isBordered/g, (match) => match.replace(/\s+isBordered/g, ''));
  
  // 21. Fix Avatar: color="primary" → color="accent" 
  content = content.replace(/<Avatar[^>]*color="primary"/g, (match) => match.replace('color="primary"', 'color="accent"'));
  
  // 22. Fix Avatar: showFallback → remove (v3 shows fallback automatically)
  content = content.replace(/\s+showFallback/g, '');

  // 23. Fix Button: as="a" → wrap with <a> (complex, skip for now)

  // 24. Fix Card: isPressable → remove
  content = content.replace(/\s+isPressable/g, '');
  content = content.replace(/\s+onPress(?==)/g, ''); // onPress={...} on non-interactive elements

  // 25. Remove Accordion variant="default" when it's the default
  // Keep as is - "default" is valid in v3

  // 26. Fix Badge variant="flat" → variant="soft" or similar
  content = content.replace(/<Badge[^>]*variant="flat"/g, (match) => match.replace('variant="flat"', 'variant="soft"'));
  content = content.replace(/<Badge[^>]*variant="solid"/g, (match) => match.replace('variant="solid"', 'primary"'));

  if (content !== original) {
    totalModified++;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modified: ${rel}`);
  }
}

console.log(`\nDone! Modified ${totalModified} files with v3 prop fixes.`);
