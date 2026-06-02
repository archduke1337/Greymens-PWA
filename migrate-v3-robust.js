// Final robust migration pass - handles multiline patterns
const fs = require('fs');
const path = require('path');

let totalFixes = 0;

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return false;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // Skip compat.tsx
  if (filePath.includes('compat.tsx')) return false;
  // Only process files that import from @heroui/react
  if (!content.includes('@heroui/react')) return false;

  // === BUTTON: remove color prop (multiline-safe) ===
  content = content.replace(/(<Button\b[^>]*)\s+color="(?:primary|danger|default|success|warning|secondary)"/g, '$1');
  // Handle multiline: color on its own line before another prop
  content = content.replace(/(<Button\b[\s\S]*?)\n(\s+)color="(?:primary|danger|default|success|warning|secondary)"/g, '$1');

  // === BUTTON: startContent → children ===
  content = content.replace(/(<Button\b[^>]*)\s+startContent=\{([^}]*)\}/g, (m, before, content_val) => {
    return before + '>';
  });

  // === SWITCH: checked → isSelected ===
  content = content.replace(/(<Switch\b[\s\S]*?)\n(\s+)checked=\{/g, '$1\n$2isSelected={');
  content = content.replace(/(<Switch\b[^>]*)\s+checked=\{/g, '$1 isSelected={');

  // === CHIP: color values ===
  content = content.replace(/(<Chip\b[^>]*?)\s+color="primary"/g, '$1 color="accent"');
  content = content.replace(/(<Chip\b[^>]*?)\s+color="secondary"/g, '$1 color="default"');

  // === VARIANT VALUES (all components) ===
  content = content.replace(/variant="solid"/g, 'variant="primary"');
  content = content.replace(/variant="bordered"/g, 'variant="secondary"');
  content = content.replace(/variant="light"/g, 'variant="soft"');
  content = content.replace(/variant="flat"/g, 'variant="tertiary"');
  content = content.replace(/variant="faded"/g, 'variant="secondary"');
  content = content.replace(/variant="shadow"/g, 'variant="primary"');
  content = content.replace(/variant="outline"/g, 'variant="secondary"');

  // === INPUT: remove v2-only props (multiline-safe) ===
  // label on its own line
  content = content.replace(/\n(\s+)label="[^"]*"/g, '');
  content = content.replace(/(<Input\b[^>]*)\s+label="[^"]*"/g, '$1');
  // description on its own line
  content = content.replace(/\n(\s+)description="[^"]*"/g, '');
  content = content.replace(/(<Input\b[^>]*)\s+description="[^"]*"/g, '$1');
  // startContent on its own line or inline
  content = content.replace(/\n(\s+)startContent=\{[\s\S]*?\}(?=\s*\n)/g, '');
  content = content.replace(/(<Input\b[^>]*)\s+startContent=\{[^}]*\}/g, '$1');
  // classNames={{...}} on its own line
  content = content.replace(/\n(\s+)classNames=\{\{[\s\S]*?\}\}/g, '');
  // isDisabled → disabled
  content = content.replace(/\bisDisabled\b/g, 'disabled');
  content = content.replace(/\bisRequired\b/g, 'required');

  // === TEXTAREA: remove v2-only props ===
  content = content.replace(/\n(\s+)label="[^"]*"/g, '');
  content = content.replace(/\n(\s+)classNames=\{\{[\s\S]*?\}\}/g, '');

  // === SELECT ===
  content = content.replace(/selectedKeys=\{\[([^\]]*)\]\}/g, 'value={$1}');
  content = content.replace(/\n(\s+)label="[^"]*"/g, '');
  content = content.replace(/\n(\s+)classNames=\{\{[\s\S]*?\}\}/g, '');
  content = content.replace(/<SelectItem\b/g, '<ListBoxItem');
  content = content.replace(/<\/SelectItem>/g, '</ListBoxItem>');

  // === MODAL ===
  content = content.replace(/(<Modal\b[^>]*)\s+close=\{[^}]*\}/g, '$1');
  content = content.replace(/(<Modal\b[^>]*)\s+scrollBehavior="[^"]*"/g, '$1');
  content = content.replace(/\n(\s+)classNames=\{\{[\s\S]*?\}\}/g, '');

  // === TABS ===
  content = content.replace(/(<Tabs\b[^>]*)\s+color="[^"]*"/g, '$1');

  // === AVATAR ===
  content = content.replace(/(<Avatar\b[^>]*)\s+isBordered/g, '$1');
  content = content.replace(/(<Avatar\b[^>]*)\s+color="[^"]*"/g, '$1');

  // === ACCORDION ===
  content = content.replace(/(<Accordion\b[^>]*)\s+variant="outline"/g, '$1 variant="default"');
  content = content.replace(/(<Accordion\b[^>]*)\s+selectionMode="[^"]*"/g, '$1');
  content = content.replace(/<AccordionItem\s+key="[^"]*"\s+aria-label="[^"]*"\s+title=/g, '<AccordionItem title=');
  content = content.replace(/<AccordionItem\s+key="[^"]*"\s+title=/g, '<AccordionItem title=');
  content = content.replace(/<AccordionItem\s+key="[^"]*"\s+aria-label="[^"]*"/g, '<AccordionItem');

  // === CARD ===
  content = content.replace(/(<Card\b[^>]*)\s+isPressable/g, '$1');
  content = content.replace(/\n(\s+)onPress=\{[^}]*\}/g, '');

  // === LINK ===
  content = content.replace(/<Link\s+as=\{NextLink\}/g, '<Link');
  content = content.replace(/(<Link\b[^>]*)\s+size="[^"]*"/g, '$1');

  // === isLoading → isPending ===
  content = content.replace(/\bisLoading\b/g, 'isPending');

  // === as="a" on Button ===
  content = content.replace(
    /<Button\s+as="a"\s+(href="[^"]*"\s+target="[^"]*"\s+rel="[^"]*")/g,
    (m, attrs) => '<a ' + attrs + '><Button'
  );

  // Cleanup
  content = content.replace(/\n{3,}/g, '\n\n');
  content = content.replace(/\r\n/g, '\n');
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Fixed: ' + filePath);
    totalFixes++;
    return true;
  }
  return false;
}

function walkDir(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        fixFile(relPath);
      }
    }
  } catch(e) {}
}

walkDir(path.join(process.cwd(), 'app'));
walkDir(path.join(process.cwd(), 'components'));

console.log('\nTotal files fixed: ' + totalFixes);
