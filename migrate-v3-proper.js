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

  // Step 1: Switch imports from compat to @heroui/react
  content = content.replace(/from\s+["']@\/components\/compat["']/g, 'from "@heroui/react"');

  // Step 2: Fix import names that changed in v3
  // ListBoxItem is available in v3 as ListBoxItem, so no change needed
  // ModalDialog → ModalDialog (flat export exists), ModalBody → ModalBody, etc.
  // These are all available as flat exports in v3, so imports stay the same

  // Step 3: Fix Button props
  // Remove color="primary|danger|default|success|warning|secondary" from Button
  // In v3, Button uses variant instead of color
  // v2 color="primary" variant="solid" → v3 variant="primary"
  // v2 color="danger" variant="solid" → v3 variant="danger"
  // v2 color="default" → v3 variant="primary" (default in v3)
  // v2 color="success" → v3 variant="primary" (no success variant)
  // v2 color="warning" → v3 variant="primary" (no warning variant)
  // v2 color="secondary" → v3 variant="secondary"

  // Fix isLoading → isPending on Button
  content = content.replace(/isLoading(=\{)/g, 'isPending$1');
  content = content.replace(/isLoading(=)/g, 'isPending$1');

  // Fix Switch onValueChange → onChange
  content = content.replace(/onValueChange(=\{)/g, 'onChange$1');

  // Fix Switch isSelected already correct (our compat already uses it)

  // Fix Accordion variant="outline" → variant="default"
  content = content.replace(/variant="outline"/g, 'variant="default"');

  // Fix AccordionItem accordionItem variant fixes
  content = content.replace(/variant="splitted"/g, 'variant="default"');

  // Fix className not classNames (already handled by compat, but check)
  // classNames={{...}} should become className="..." but this is complex, skip for now

  // Fix isBordered on Avatar → remove it (use Tailwind ring-2 ring-background)
  // Only on Avatar imports, not other components
  // We'll handle this in manual fixes

  // Step 4: Fix Button variant values from compat v2 style to v3
  // compat had: solid, bordered, light, flat, faded, shadow, ghost, primary, outline, dot
  // v3 has: primary, secondary, tertiary, outline, ghost, danger, danger-soft
  // So:
  // variant="solid" → variant="primary"
  // variant="bordered" → variant="secondary"  
  // variant="light" → variant="tertiary"
  // variant="flat" → variant="tertiary"
  // variant="faded" → variant="secondary"
  // variant="shadow" → variant="primary" (use Tailwind shadow)
  // variant="ghost" → variant="ghost"
  // variant="dot" → variant="primary"
  // But we need to be careful: only replace when it's on a Button, not on Chip or other components

  // Step 5: Fix Chip variants and colors
  // v3 Chip: variant primary/secondary/tertiary/soft, color accent/success/warning/danger/default
  // v2 Chip: variant solid/bordered/light/flat/faded/shadow/dot, color primary/secondary/success/warning/danger/default
  // Compat Chip mapping: solid→primary color, bordered→outline, light→ghost
  // v3 mapping: solid→primary, bordered→secondary, light→soft, flat→tertiary

  if (content !== original) {
    totalModified++;
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Modified: ${rel}`);
  }
}

console.log(`\nDone! Modified ${totalModified} files with safe mechanical changes.`);
