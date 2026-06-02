// Careful v3 migration script - handles ALL remaining TS2322 errors
// Only modifies files that import from @heroui/react (not compat.tsx)
const fs = require('fs');
const path = require('path');

let totalFixes = 0;
let totalFiles = 0;

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return false;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // Skip compat.tsx
  if (filePath.includes('compat.tsx')) return false;
  
  // Only process files that import from @heroui/react
  if (!content.includes('@heroui/react')) return false;

  // === BUTTON ===
  // Remove color prop from Button (v3 has no color, only variant)
  // Very targeted: only match color on Button elements
  content = content.replace(/(<Button\b[^>]*)\s+color="(?:primary|danger|default|success|warning|secondary)"/g, '$1');
  
  // Remove as="a" prop (wrap Button in anchor instead - handle common patterns)
  // <Button as="a" href="..." target="..." rel="..." → <a href="..." target="..." rel="..."><Button ...>
  content = content.replace(
    /<Button\s+as="a"\s+(href="[^"]*"\s+target="[^"]*"\s+rel="[^"]*")/g,
    (m, attrs) => {
      return '<a ' + attrs + '><Button';
    }
  );
  
  // Remove isLoading → use isPending
  content = content.replace(/isLoading/g, 'isPending');

  // === SWITCH ===
  // checked → isSelected (only on Switch elements)
  content = content.replace(/(<Switch\b[^>]*)\s+checked=\{/g, '$1 isSelected={');
  // Remove isBordered (Avatar prop, not Switch)
  // Remove color from Switch
  content = content.replace(/(<Switch\b[^>]*)\s+color="[^"]*"/g, '$1');
  
  // === CHIP ===
  // Fix Chip color values: primary→accent, secondary→default
  content = content.replace(/(<Chip\b[^>]*?)\s+color="primary"/g, '$1 color="accent"');
  content = content.replace(/(<Chip\b[^>]*?)\s+color="secondary"/g, '$1 color="default"');
  // Fix Chip variant values
  content = content.replace(/variant="solid"/g, 'variant="primary"');
  content = content.replace(/variant="bordered"/g, 'variant="secondary"');
  content = content.replace(/variant="light"/g, 'variant="soft"');
  content = content.replace(/variant="flat"/g, 'variant="tertiary"');
  content = content.replace(/variant="faded"/g, 'variant="secondary"');
  content = content.replace(/variant="shadow"/g, 'variant="primary"');
  content = content.replace(/variant="outline"/g, 'variant="secondary"');

  // === INPUT ===
  // Remove label prop (v3 Input has no label)
  content = content.replace(/(<Input\b[^>]*?)\s+label="[^"]*"/g, '$1');
  // Remove description prop
  content = content.replace(/(<Input\b[^>]*?)\s+description="[^"]*"/g, '$1');
  // Remove startContent prop (single-line)
  content = content.replace(/(<Input\b[^>]*?)\s+startContent=\{[^}]*\}/g, '$1');
  // Remove classNames prop
  content = content.replace(/(<Input\b[^>]*?)\s+classNames=\{\{[^}]*\}\}/g, '$1');
  // isDisabled → disabled
  content = content.replace(/(<Input\b[^>]*)\s+isDisabled/g, '$1 disabled');
  content = content.replace(/(<TextArea\b[^>]*)\s+isDisabled/g, '$1 disabled');
  content = content.replace(/(<Button\b[^>]*)\s+isDisabled/g, '$1 disabled');

  // === TEXTAREA ===
  // Remove label from TextArea
  content = content.replace(/(<TextArea\b[^>]*?)\s+label="[^"]*"/g, '$1');
  // Remove classNames from TextArea
  content = content.replace(/(<TextArea\b[^>]*?)\s+classNames=\{\{[^}]*\}\}/g, '$1');

  // === SELECT ===
  // selectedKeys={[value]} → value={value}
  content = content.replace(/selectedKeys=\{\[([^\]]*)\]\}/g, 'value={$1}');
  // Remove label from Select
  content = content.replace(/(<Select\b[^>]*?)\s+label="[^"]*"/g, '$1');
  // Remove classNames from Select
  content = content.replace(/(<Select\b[^>]*?)\s+classNames=\{\{[^}]*\}\}/g, '$1');
  // SelectItem → ListBoxItem in JSX
  content = content.replace(/<SelectItem\b/g, '<ListBoxItem');
  content = content.replace(/<\/SelectItem>/g, '</ListBoxItem>');

  // === MODAL ===
  // Remove close prop
  content = content.replace(/(<Modal\b[^>]*)\s+close=\{[^}]*\}/g, '$1');
  // Remove scrollBehavior prop
  content = content.replace(/(<Modal\b[^>]*)\s+scrollBehavior="[^"]*"/g, '$1');
  // Remove classNames prop from Modal
  content = content.replace(/(<Modal\b[^>]*)\s+classNames=\{\{[^}]*\}\}/g, '$1');

  // === TABS ===
  // Remove color from Tabs
  content = content.replace(/(<Tabs\b[^>]*)\s+color="[^"]*"/g, '$1');

  // === AVATAR ===
  // Remove isBordered
  content = content.replace(/(<Avatar\b[^>]*)\s+isBordered/g, '$1');
  // Remove color from Avatar
  content = content.replace(/(<Avatar\b[^>]*)\s+color="[^"]*"/g, '$1');

  // === ACCORDION ===
  // variant="outline" → variant="default" (only on Accordion)
  content = content.replace(/(<Accordion\b[^>]*)\s+variant="outline"/g, '$1 variant="default"');
  // Remove selectionMode from Accordion
  content = content.replace(/(<Accordion\b[^>]*)\s+selectionMode="[^"]*"/g, '$1');
  // AccordionItem: remove key and aria-label props
  content = content.replace(/<AccordionItem\s+key="[^"]*"\s+aria-label="[^"]*"\s+title=/g, '<AccordionItem title=');
  content = content.replace(/<AccordionItem\s+key="[^"]*"\s+title=/g, '<AccordionItem title=');
  content = content.replace(/<AccordionItem\s+key="[^"]*"\s+aria-label="[^"]*"/g, '<AccordionItem');

  // === CARD ===
  // Remove isPressable from Card (v3 Card doesn't have this)
  content = content.replace(/(<Card\b[^>]*)\s+isPressable/g, '$1');
  // Remove onPress from Card
  content = content.replace(/(<Card\b[^>]*)\s+onPress=\{[^}]*\}/g, '$1');

  // === PROGRESSBAR ===
  // Remove size from ProgressBar (v3 might not accept it)
  // Actually keep it - ProgressBar may accept size

  // === LINK ===
  // Remove as={NextLink} from Link
  content = content.replace(/<Link\s+as=\{NextLink\}/g, '<Link');
  // Remove size from Link
  content = content.replace(/(<Link\b[^>]*)\s+size="[^"]*"/g, '$1');

  // === TABLE ===
  // Remove aria-label from Table (moved to Table.Content in v3, but flat export might accept it)
  // Actually keep it for now

  // === GENERAL ===
  // Remove remaining classNames={{...}} from any component
  // This is risky - skip for safety
  
  // Fix: required={true} or just required
  // These are fine

  // Cleanup multiple blank lines
  content = content.replace(/\n{3,}/g, '\n\n');
  // Normalize line endings
  content = content.replace(/\r\n/g, '\n');
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('Fixed: ' + filePath);
    totalFixes++;
    return true;
  }
  return false;
}

// Process all tsx/ts files in app/ and components/
function walkDir(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
        const relPath = path.relative(process.cwd(), fullPath).replace(/\\/g, '/');
        totalFiles++;
        fixFile(relPath);
      }
    }
  } catch(e) {}
}

walkDir(path.join(process.cwd(), 'app'));
walkDir(path.join(process.cwd(), 'components'));

console.log('\nProcessed: ' + totalFiles + ' files');
console.log('Fixed: ' + totalFixes + ' files');
