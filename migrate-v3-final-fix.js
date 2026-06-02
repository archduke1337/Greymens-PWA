// Final fix script - fixed syntax
const fs = require('fs');
const path = require('path');

let totalFixes = 0;

function fixFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return false;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // 1. Fix Item → ListBoxItem in imports
  content = content.replace(
    /import\s*\{([^}]*),\s*Item\s*([^}]*)\}\s*from\s*"@heroui\/react"/g, 
    (m, before, after) => `import {${before}, ListBoxItem${after}} from "@heroui/react"`
  );
  
  // 2. Fix Item → ListBoxItem in JSX
  content = content.replace(/<Item\s+key="/g, '<ListBoxItem id="');
  content = content.replace(/<\/Item>/g, '</ListBoxItem>');

  // 3. Fix duplicate required attributes
  content = content.replace(/required\s*\r?\n\s*required/g, 'required');
  content = content.replace(/isRequired\s*\r?\n\s*isRequired/g, 'required');

  // 4. Fix RouteError missing description prop
  content = content.replace(
    /<RouteError\s+error=\{error\}\s+reset=\{reset\}\s+title="([^"]*)"(\s*\/?>)/g,
    '<RouteError error={error} reset={reset} title="$1" description=""$2'
  );

  // 5. Fix variant="shadow" → "primary"
  content = content.replace(/variant="shadow"/g, 'variant="primary"');

  // 6. Fix remaining "color" on Button
  content = content.replace(/(<Button[^>]*)\s+color="[^"]*"/g, '$1');

  // 7. Fix isBordered on Avatar (not in v3)
  content = content.replace(/isBordered/g, '');

  // 8. Fix any remaining "isRequired" → "required"
  // Only on Input/TextArea/Select contexts
  content = content.replace(/isRequired(?=\s|>)/g, 'required');

  // 9. Fix "as" on Button → wrap in anchor
  // Handle <Button as="a" href="..." ...> 
  content = content.replace(
    /<Button\s+as="a"\s+(href="[^"]*"\s+target="[^"]*"\s+rel="[^"]*")/g,
    (m, attrs) => `<a ${attrs}><Button`
  );
  content = content.replace(
    /<Button\s+isIconOnly\s+as="a"\s+(href="[^"]*"\s+target="[^"]*"\s+rel="[^"]*")/g,
    (m, attrs) => `<a ${attrs}><Button isIconOnly`
  );
  
  // 10. Fix classNames={{...}} removal (remaining)
  content = content.replace(/\s+classNames=\{\{[\s\S]*?\}\}/g, '');

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
}

walkDir(path.join(process.cwd(), 'app'));
walkDir(path.join(process.cwd(), 'components'));

console.log('\nTotal files fixed: ' + totalFixes);
