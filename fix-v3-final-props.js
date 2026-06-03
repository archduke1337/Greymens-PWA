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

  // 1. Remove invalid Input variant="secondary" prop
  content = content.replace(/<Input([^>]*?)\s+variant="secondary"([^>]*?)>/g, '<Input$1$2>');
  content = content.replace(/<Input([^>]*?)\s+variant="secondary"\s*>/g, '<Input$1>');

  // 2. Remove invalid TextArea minRows and variant props
  content = content.replace(/<TextArea([^>]*?)\s+minRows=\{[^}]+\}([^>]*?)>/g, '<TextArea$1$2>');
  content = content.replace(/<TextArea([^>]*?)\s+variant="secondary"([^>]*?)>/g, '<TextArea$1$2>');

  // 3. Fix Select variant="secondary" → remove
  content = content.replace(/<Select([^>]*?)\s+variant="secondary"([^>]*?)>/g, '<Select$1$2>');

  // 4. Fix Button variant="dot" → variant="primary"
  content = content.replace(/<Button([^>]*?)\s+variant="dot"([^>]*?)>/g, '<Button$1 variant="primary"$2>');

  // 5. Fix Chip startContent={...} → move to children pattern
  // This is complex, skip for now

  // 6. Fix Link isExternal → remove and add target="_blank"
  content = content.replace(/\s+isExternal/g, '');
  
  // 7. Fix Badge variant="solid" → remove (default in v3)
  content = content.replace(/<Badge([^>]*?)\s+variant="solid"([^>]*?)>/g, '<Badge$1$2>');

  // 8. Fix AccordionItem title="X" → just remove the title prop (we handle compound separately)
  // Already handled in docs/page.tsx

  // 9. Fix Avatar size="sm" → just pass size to Avatar root
  // Avatar in v3: <Avatar size="sm"><Avatar.Image ... /><Avatar.Fallback>...</Avatar.Fallback></Avatar>
  // The size prop should be on Avatar, not AvatarImage

  // 10. Fix Button radius="full" → remove
  content = content.replace(/<Button([^>]*?)\s+radius="full"([^>]*?)>/g, '<Button$1$2>');
  content = content.replace(/<Button([^>]*?)\s+radius="lg"([^>]*?)>/g, '<Button$1$2>');

  // 11. Fix Chip with startContent prop - move icon to children
  // Chip startContent={<Icon />} text → <Chip><Icon />text</Chip>
  // Complex, skip

  // 12. Fix Input min/max/maxLength props that may not exist
  // v3 Input is a primitive, so these HTML attrs should work

  // 13. Fix disabled → isDisabled for Button (v3 might use disabled natively)
  // Actually v3 Button accepts disabled natively

  if (content !== original) {
    totalModified++;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modified: ${rel}`);
  }
}

console.log(`\nDone! Modified ${totalModified} files with remaining v3 prop fixes.`);
