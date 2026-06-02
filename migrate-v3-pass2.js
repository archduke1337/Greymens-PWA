// Second-pass migration: fix remaining v2→v3 prop issues
const fs = require('fs');
const path = require('path');

// Step 1: Fix the 5 restored files
const restoredFiles = [
  'app/gallery/page.tsx',
  'app/team/page.tsx', 
  'app/admin/sponsors/page.tsx',
  'app/Blog/page.tsx',
  'app/sponsors/page.tsx',
];

function migrateFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return false;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const original = content;

  // Button: remove color prop
  content = content.replace(/<Button\s+color="(?:primary|danger|default|success|warning|secondary)"\s*/g, '<Button ');
  content = content.replace(/(\s+)color="(?:primary|danger|default|success|warning|secondary)"(\s+(?:variant|isPending|onPress|className|size|type|isIconOnly|isDisabled|onValueChange))/g, '$1$2');
  content = content.replace(/(\s+)color="(?:primary|danger|default|success|warning|secondary)"(\s*>)/g, '$1$2');
  content = content.replace(/(\s+)color="(?:primary|danger|default|success|warning|secondary)"(\s*\n)/g, '$1$2');
  
  // Switch: checked → isSelected
  content = content.replace(/checked=\{/g, 'isSelected={');
  
  // Switch: remove color
  content = content.replace(/<Switch\s+color="(?:warning|primary|secondary|success|danger|default)"\s*/g, '<Switch ');
  content = content.replace(/(\s+)color="(?:warning|primary|secondary|success|danger|default)"(\s+onChange)/g, '$1$2');
  content = content.replace(/(\s+)color="(?:warning|primary|secondary|success|danger|default)"(\s*>)/g, '$1$2');
  
  // Chip: color mapping
  content = content.replace(/color="primary"/g, 'color="accent"');
  content = content.replace(/color="secondary"/g, 'color="default"');
  
  // Chip: variant mapping
  content = content.replace(/variant="solid"/g, 'variant="primary"');
  content = content.replace(/variant="bordered"/g, 'variant="secondary"');
  content = content.replace(/variant="light"/g, 'variant="soft"');
  content = content.replace(/variant="flat"/g, 'variant="tertiary"');

  // Input: remove label prop (line with just label)
  content = content.replace(/\n\s+label="[^"]*"/g, '');
  content = content.replace(/\s+label=\{[^}]*\}/g, '');
  
  // Input: remove description prop
  content = content.replace(/\n\s+description="[^"]*"/g, '');
  
  // Input: remove startContent prop (single and multi-line)
  content = content.replace(/\n\s+startContent=\{[^}]*\}/g, '');
  
  // Input: remove classNames prop blocks
  content = content.replace(/\n\s+classNames=\{\{[\s\S]*?\}\}/g, '');
  
  // Input: isRequired → required
  content = content.replace(/isRequired(?=\s|>)/g, 'required');
  
  // Input: remove endContent prop
  content = content.replace(/\n\s+endContent=\{[^}]*\}/g, '');
  
  // Select: SelectItem → Item
  content = content.replace(/SelectItem/g, 'Item');
  
  // Select: selectedKeys={[value]} → value={value}
  content = content.replace(/selectedKeys=\{\[([^\]]*)\]\}/g, 'value={$1}');
  
  // Tabs: remove color
  content = content.replace(/(<Tabs[^>]*?)\s+color="[^"]*"/g, '$1');
  
  // Modal: remove close, scrollBehavior, classNames
  content = content.replace(/\s+close=\{[^}]*\}/g, '');
  content = content.replace(/\s+scrollBehavior="[^"]*"/g, '');
  content = content.replace(/\s+classNames=\{\{[\s\S]*?\}\}/g, '');
  
  // TextArea: remove classNames
  content = content.replace(/(<TextArea[^>]*?)\n\s+classNames=\{\{[^}]*\}\}/g, '$1');
  
  // Cleanup multiple blank lines
  content = content.replace(/\n{3,}/g, '\n\n');
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log('✅ Fixed: ' + filePath);
    return true;
  }
  console.log('⏭️  No changes: ' + filePath);
  return false;
}

// Run on all files
const allFiles = fs.readdirSync(path.join(process.cwd(), 'app'), { recursive: true })
  .filter(f => f.endsWith('.tsx'))
  .map(f => 'app/' + f)
  .concat(
    fs.readdirSync(path.join(process.cwd(), 'components'), { recursive: true })
      .filter(f => f.endsWith('.tsx'))
      .map(f => 'components/' + f)
  );

let count = 0;
allFiles.forEach(f => { if (migrateFile(f)) count++; });
console.log('\n📊 Total files modified: ' + count);
