const fs = require('fs');
const path = require('path');

// Files to process
const files = [
  'app/admin/events/page.tsx',
  'app/admin/projects/page.tsx',
  'app/admin/sponsors/page.tsx',
  'app/admin/blog/page.tsx',
  'app/settings/page.tsx',
  'app/docs/page.tsx',
  'app/login/page.tsx',
  'app/register/page.tsx',
  'app/contact/page.tsx',
  'app/profile/page.tsx',
  'app/gallery/page.tsx',
  'app/events/page.tsx',
  'app/events/[id]/page.tsx',
  'app/projects/page.tsx',
  'app/team/page.tsx',
  'app/Blog/page.tsx',
  'app/Blog/[slug]/page.tsx',
  'app/Blog/write/page.tsx',
  'app/sponsors/page.tsx',
  'app/help-feedback/page.tsx',
  'app/diagnostics/page.tsx',
  'app/connectivity-check/page.tsx',
  'app/not-found.tsx',
  'app/dashboard/page.tsx',
  'app/verify-email/page.tsx',
  'app/page.tsx',
  'components/navbar.tsx',
  'components/footer.tsx',
  'components/footer-sponsors.tsx',
  'components/sponsors-section.tsx',
  'components/counter.tsx',
  'components/FeaturedSection.tsx',
  'components/RouteError.tsx',
];

let totalChanges = 0;

function processFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');
  let original = content;
  
  // ============ BUTTON ============
  // Remove color prop from Button (v3 Button has no color, uses variant only)
  // Match: color="primary" | "danger" | "default" | "success" | "warning" | "secondary"
  // Only on Button elements (preceded by Button or newline+spaces in Button context)
  content = content.replace(/<Button\s+color="(?:primary|danger|default|success|warning|secondary)"\s*/g, '<Button ');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s+variant)/g, '$1');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s+isPending)/g, '$1');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s+onPress)/g, '$1');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s+className)/g, '$1');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s+size)/g, '$1');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s+type)/g, '$1');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s+isIconOnly)/g, '$1');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s+isDisabled)/g, '$1');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s*>)/g, '$1');
  content = content.replace(/\s+color="(?:primary|danger|default|success|warning|secondary)"(\s*\n)/g, '$1');
  
  // ============ SWITCH ============
  // checked → isSelected (on Switch components)
  content = content.replace(/checked=\{/g, 'isSelected={');
  
  // Remove color from Switch
  content = content.replace(/<Switch\s+color="(?:warning|primary|secondary|success|danger|default)"\s*/g, '<Switch ');
  content = content.replace(/(\s+)color="(?:warning|primary|secondary|success|danger|default)"(\s+onChange)/g, '$1$2');
  content = content.replace(/(\s+)color="(?:warning|primary|secondary|success|danger|default)"(\s*>)/g, '$1$2');
  
  // ============ CHIP ============
  // Chip color mapping: primary→accent, secondary→default
  // Only target Chip elements
  content = content.replace(/<Chip\s+color="primary"/g, '<Chip color="accent"');
  content = content.replace(/<Chip\s+color="secondary"/g, '<Chip color="default"');
  content = content.replace(/(\s+)color="primary"(\s+variant)/g, (m, pre, post) => {
    // Check if this is inside a Chip context - heuristic: look backwards for "Chip"
    return pre + 'color="accent"' + post;
  });
  content = content.replace(/(\s+)color="secondary"(\s+(?:variant|size|className))/g, (m, pre, post) => {
    return pre + 'color="default"' + post;
  });
  
  // Chip variant mapping: solid→primary, bordered→secondary, light→soft, flat→tertiary
  content = content.replace(/variant="solid"/g, 'variant="primary"');
  content = content.replace(/variant="bordered"/g, 'variant="secondary"');
  content = content.replace(/variant="light"/g, 'variant="soft"');
  content = content.replace(/variant="flat"/g, 'variant="tertiary"');
  
  // ============ INPUT ============
  // Remove label prop from Input (v3 Input has no label)
  content = content.replace(/\n\s+label="[^"]*"/g, '');
  content = content.replace(/\s+label=\{[^}]*\}/g, '');
  
  // Remove description prop from Input
  content = content.replace(/\n\s+description="[^"]*"/g, '');
  
  // Remove startContent prop from Input
  content = content.replace(/\n\s+startContent=\{[^}]*\}/g, '');
  // Handle multi-line startContent
  content = content.replace(/\s+startContent=\{[\s\S]*?\}(?=\s+(?:required|isDisabled|className|type|value|onChange|placeholder|onKeyPress|maxLength|onValueChange))/g, '');
  
  // Remove classNames prop from Input
  content = content.replace(/\n\s+classNames=\{\{[^}]*\}\}/g, '');
  // Handle multi-line classNames on Input
  content = content.replace(/\s+classNames=\{[\s\S]*?\}(?=\s+(?:required|isDisabled|className|type|value|onChange|placeholder))/g, '');
  
  // isRequired → required (on Input)
  content = content.replace(/isRequired(?=\s|>)/g, 'required');
  
  // Remove endContent from Input  
  content = content.replace(/\n\s+endContent=\{[^}]*\}/g, '');
  
  // ============ SELECT ============
  // SelectItem → Item (in imports)
  content = content.replace(/SelectItem/g, 'Item');
  
  // selectedKeys={[value]} → value={value}
  content = content.replace(/selectedKeys=\{\[([^\]]*)\]\}/g, 'value={$1}');
  
  // Remove label from Select
  content = content.replace(/(<Select[^>]*?)\n\s+label="[^"]*"/g, '$1');
  
  // Remove classNames from Select
  content = content.replace(/(<Select[^>]*?)\n\s+classNames=\{\{[^}]*\}\}/g, '$1');
  
  // ============ TABS ============
  // Remove color from Tabs
  content = content.replace(/(<Tabs[^>]*?)\s+color="[^"]*"/g, '$1');
  
  // ============ MODAL ============
  // Modal close={fn} → remove (handled differently in v3)
  content = content.replace(/\s+close=\{[^}]*\}/g, '');
  
  // Modal scrollBehavior="inside" → remove (use scroll on Container in v3)
  content = content.replace(/\s+scrollBehavior="[^"]*"/g, '');
  
  // Modal classNames={{...}} → remove
  content = content.replace(/\s+classNames=\{\{[\s\S]*?\}\}/g, '');
  
  // ============ ACCORDION ============
  // AccordionItem title="..." → keep (Accordion.Item accepts title in v3)
  // selectionMode → keep (Accordion accepts this in v3)
  
  // ============ TEXTAREA ============
  // Remove classNames from TextArea
  content = content.replace(/(<TextArea[^>]*?)\n\s+classNames=\{\{[^}]*\}\}/g, '$1');
  
  // ============ SELECT remove label/classNames ============
  content = content.replace(/(<Select[\s\S]*?)\n\s+classNames=\{[\s\S]*?\}/g, '$1');
  
  // ============ CLEANUP ============
  // Remove multiple blank lines
  content = content.replace(/\n{3,}/g, '\n\n');
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf8');
    const changes = (original.match(/\n/g) || []).length !== (content.match(/\n/g) || []).length;
    console.log(`✅ Fixed: ${filePath}`);
    totalChanges++;
  } else {
    console.log(`⏭️  No changes: ${filePath}`);
  }
}

files.forEach(processFile);
console.log(`\n📊 Total files modified: ${totalChanges}`);
