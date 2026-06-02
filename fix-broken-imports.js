const fs = require('fs');
const path = require('path');

// All components that come from the compat layer
const COMPAT_COMPONENTS = [
  'useDisclosure', 'SelectItem', 'AvatarGroup',
  'Button', 'Card', 'CardContent', 'CardHeader', 'CardFooter',
  'Input', 'TextArea', 'Select', 'Switch',
  'Modal', 'ModalDialog', 'ModalHeader', 'ModalBody', 'ModalFooter',
  'Tabs', 'Tab', 'Chip', 'Badge', 'Avatar',
  'Table', 'TableHeader', 'TableColumn', 'TableBody', 'TableRow', 'TableCell',
  'ProgressBar', 'Separator', 'Spinner',
  'Accordion', 'AccordionItem', 'Link',
  'Dropdown', 'DropdownTrigger', 'DropdownMenu', 'DropdownItem'
];

function findAllFiles(dir) {
  const results = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        results.push(...findAllFiles(fullPath));
      } else if (item.name.endsWith('.tsx') || item.name.endsWith('.ts')) {
        results.push(fullPath);
      }
    }
  } catch (e) {}
  return results;
}

const files = [...findAllFiles('app'), ...findAllFiles('components')];
let fixed = 0;

for (const file of files) {
  try {
    let content = fs.readFileSync(file, 'utf8');
    
    // Find current compat imports
    const compatImportMatch = content.match(/import\s+\{([^}]+)\}\s+from\s+["']@\/components\/compat["']/);
    
    // Find what compat components are actually used in the file (JSX usage)
    const usedComponents = [];
    for (const comp of COMPAT_COMPONENTS) {
      // Skip hooks - they're used differently
      if (comp === 'useDisclosure') {
        if (content.includes('useDisclosure(')) usedComponents.push(comp);
        continue;
      }
      // Check for JSX usage: <ComponentName or as="a" etc
      const jsxRegex = new RegExp('<' + comp + '[\\s/>]', 'g');
      if (jsxRegex.test(content)) {
        usedComponents.push(comp);
      }
    }
    
    if (usedComponents.length === 0) continue;
    
    // Get current imported components
    const currentImports = compatImportMatch 
      ? compatImportMatch[1].split(',').map(s => s.trim().split(' as ')[0].trim()).filter(n => n)
      : [];
    
    // Merge: keep current imports + add missing ones
    const allNeeded = [...new Set([...currentImports, ...usedComponents])].sort();
    
    // Build the new import line
    const newImport = `import { ${allNeeded.join(', ')} } from "@/components/compat"`;
    
    if (compatImportMatch) {
      // Replace existing import
      const oldImport = compatImportMatch[0];
      if (oldImport !== newImport) {
        content = content.replace(oldImport, newImport);
        fs.writeFileSync(file, content);
        console.log(`FIXED: ${file} — now imports: ${allNeeded.join(', ')}`);
        fixed++;
      }
    } else {
      // No compat import exists - need to add one
      // Find the last import statement and add after it
      const importLines = content.split('\n');
      let lastImportIdx = -1;
      for (let i = 0; i < importLines.length; i++) {
        if (importLines[i].trim().startsWith('import ')) {
          lastImportIdx = i;
        }
      }
      if (lastImportIdx >= 0) {
        importLines.splice(lastImportIdx + 1, 0, newImport);
        content = importLines.join('\n');
        fs.writeFileSync(file, content);
        console.log(`ADDED: ${file} — imports: ${allNeeded.join(', ')}`);
        fixed++;
      }
    }
  } catch (e) {
    console.error(`ERROR: ${file}: ${e.message}`);
  }
}

console.log(`\nTotal files fixed: ${fixed}`);
