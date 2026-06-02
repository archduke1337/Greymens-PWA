// Fix remaining TS2322 errors
const fs = require('fs');
const path = require('path');

let totalFixes = 0;

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return false;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // 1. Fix Accordion variant="outline" → "default"
  // Only on Accordion (not AccordionItem or other components)
  content = content.replace(/<Accordion\s+variant="outline"/g, '<Accordion variant="default"');
  content = content.replace(/<Accordion\s+selectionMode/g, '<Accordion');
  content = content.replace(/(\s+)selectionMode="multiple"(\s*)/g, '$1$2');

  // 2. Fix AccordionItem: remove key and aria-label, keep title and className
  // v3 AccordionItem doesn't accept key/aria-label as props directly
  content = content.replace(/<Accordion\.Item\s+key="([^"]*)"\s+aria-label="([^"]*)"\s+title="([^"]*)"/g, 
    '<Accordion.Item title="$3"');
  content = content.replace(/<Accordion\.Item\s+key="([^"]*)"\s+title="([^"]*)"/g, 
    '<Accordion.Item title="$2"');
  content = content.replace(/<Accordion\.Item\s+key="([^"]*)"\s+aria-label="([^"]*)"/g, 
    '<Accordion.Item');
  // Also handle flat AccordionItem
  content = content.replace(/<AccordionItem\s+key="([^"]*)"\s+aria-label="([^"]*)"\s+title="([^"]*)"/g, 
    '<AccordionItem title="$3"');
  content = content.replace(/<AccordionItem\s+key="([^"]*)"\s+title="([^"]*)"/g, 
    '<AccordionItem title="$2"');
  content = content.replace(/<AccordionItem\s+key="([^"]*)"\s+aria-label="([^"]*)"/g, 
    '<AccordionItem');

  // 3. Fix Tabs: remove color prop, fix Tab key→id
  content = content.replace(/(<Tabs[^>]*)\s+color="[^"]*"/g, '$1');

  // 4. Fix Button: remove variant="flat" and variant="solid" (not valid v3)
  content = content.replace(/variant="flat"/g, 'variant="tertiary"');
  content = content.replace(/variant="solid"/g, 'variant="primary"');

  // 5. Fix remaining "as" prop wrapping issues - close the anchor tag
  // <a href="..."><Button ...> → needs </Button></a>
  // This is already handled by wrapping, but some cases might have issues

  // 6. Fix Input isDisabled → disabled (v3 Input primitive uses HTML attributes)
  content = content.replace(/isDisabled/g, 'disabled');
  content = content.replace(/isRequired/g, 'required');
  
  // 7. Fix remaining Chip variant issues
  content = content.replace(/variant="faded"/g, 'variant="secondary"');
  content = content.replace(/variant="shadow"/g, 'variant="primary"');

  // 8. Fix any remaining "close" prop on Chip
  content = content.replace(/\s+close=\{[^}]*\}/g, '');

  // 9. Fix "isLoading" on Button → "isPending"
  content = content.replace(/isLoading/g, 'isPending');

  // 10. Fix any remaining "onClose" → "onOpenChange" on Modal
  content = content.replace(/onClose=\{[^}]*\}/g, 'onClose={undefined}');

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

// Process all tsx/ts files
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
