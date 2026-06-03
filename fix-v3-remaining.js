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

  // 1. Fix remaining TextArea minRows={N} → rows={N}
  content = content.replace(/<TextArea([^>]*)\s+minRows=\{(\d+)\}/g, '<TextArea$1 rows={$2}');
  // Also remove standalone minRows
  content = content.replace(/\s+minRows=\{[^}]+\}/g, '');

  // 2. Fix remaining TextArea variant="secondary" → remove
  content = content.replace(/\s+variant="secondary"/g, '');

  // 3. Fix remaining Button as="a" → wrap with <a>
  // Pattern: <Button as="a" href="X" ...>text</Button>
  // This is complex multi-line, skip for now - will handle with str_replace

  // 4. Fix remaining Button startContent={...} → move to children
  // Pattern: <Button startContent={<Icon />} ...>text</Button>
  // This is complex, skip for now

  // 5. Fix Switch: remove invalid `size` prop if present
  content = content.replace(/<Switch([^>]*)\s+size="[^"]*"/g, '<Switch$1');

  // 6. Fix Avatar: remove invalid `src`, `name`, `showFallback` props  
  // These need structural changes - handled per-file below

  // 7. Fix Chip: already fixed variant values, but check for remaining "solid"/"flat"
  // variant="solid" → variant="primary" (on Chip only)
  content = content.replace(/<Chip([^>]*)\s+variant="solid"/g, '<Chip$1 variant="primary"');
  content = content.replace(/<Chip([^>]*)\s+variant="flat"/g, '<Chip$1 variant="tertiary"');
  content = content.replace(/<Chip([^>]*)\s+variant="bordered"/g, '<Chip$1 variant="secondary"');
  content = content.replace(/<Chip([^>]*)\s+variant="light"/g, '<Chip$1 variant="soft"');

  // 8. Fix Button: remaining variant values  
  content = content.replace(/<Button([^>]*)\s+variant="solid"/g, '<Button$1 variant="primary"');
  content = content.replace(/<Button([^>]*)\s+variant="flat"/g, '<Button$1 variant="tertiary"');
  content = content.replace(/<Button([^>]*)\s+variant="bordered"/g, '<Button$1 variant="secondary"');
  content = content.replace(/<Button([^>]*)\s+variant="light"/g, '<Button$1 variant="tertiary"');

  // 9. Fix Badge: remaining variant="flat"/"solid"
  content = content.replace(/<Badge([^>]*)\s+variant="flat"/g, '<Badge$1 variant="soft"');
  content = content.replace(/<Badge([^>]*)\s+variant="solid"/g, '<Badge$1>');

  // 10. Fix Input: remaining variant="primary" → remove (v3 Input doesn't have variant)
  content = content.replace(/<Input([^>]*)\s+variant="primary"/g, '<Input$1');
  content = content.replace(/<Input([^>]*)\s+variant="flat"/g, '<Input$1');
  content = content.replace(/<Input([^>]*)\s+variant="bordered"/g, '<Input$1');
  content = content.replace(/<Input([^>]*)\s+variant="faded"/g, '<Input$1');
  content = content.replace(/<Input([^>]*)\s+variant="underlined"/g, '<Input$1');

  // 11. Fix Accordion: remove variant="outline" (already done but double-check)
  content = content.replace(/<Accordion([^>]*)\s+variant="outline"/g, '<Accordion$1 variant="default"');
  
  // 12. Fix Button: remove `size` on non-Small/Medium/Large values
  // v3 Button size: sm, md, lg - keep as is

  // 13. Fix remaining `<Item` that weren't converted to ListBoxItem
  content = content.replace(/<Item /g, '<ListBoxItem ');
  content = content.replace(/<\/Item>/g, '</ListBoxItem>');

  // 14. Fix remaining `selectedKeys` on Select → remove (v3 uses `value`)
  content = content.replace(/\s+selectedKeys=\{[^}]+\}/g, '');

  if (content !== original) {
    totalModified++;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modified: ${rel}`);
  }
}

console.log(`\nDone! Modified ${totalModified} files with additional v3 fixes.`);
