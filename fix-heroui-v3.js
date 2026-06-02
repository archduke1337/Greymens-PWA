const fs = require('fs');
const path = require('path');

// All files that import from @heroui/react
const files = [
  'components/counter.tsx',
  'components/navbar.tsx',
  'components/RouteError.tsx',
  'components/sponsors-section.tsx',
  'components/footer.tsx',
  'components/compat.tsx',
  'app/about/page.tsx',
  'app/connectivity-check/page.tsx',
  'app/gallery/page.tsx',
  'app/docs/page.tsx',
  'app/dashboard/page.tsx',
  'app/diagnostics/page.tsx',
  'app/admin/events/page.tsx',
  'app/verify-email/page.tsx',
  'app/Blog/[slug]/page.tsx',
  'app/contact/page.tsx',
  'app/events/[id]/page.tsx',
  'app/admin/projects/page.tsx',
  'app/Blog/page.tsx',
  'app/events/page.tsx',
  'app/admin/blog/page.tsx',
  'app/Blog/write/page.tsx',
  'app/admin/sponsors/page.tsx',
  'app/not-found.tsx',
  'app/team/page.tsx',
  'app/register/page.tsx',
  'app/help-feedback/page.tsx',
  'app/login/page.tsx',
  'app/profile/page.tsx',
  'app/projects/page.tsx',
  'app/sponsors/page.tsx',
  'app/settings/page.tsx',
];

let totalChanges = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.log(`SKIP (not found): ${file}`);
    continue;
  }

  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // ========== FIX BROKEN IMPORTS ==========
  // Fix: import {\nimport {} from "@/components/compat";
  content = content.replace(/import \{\s*\nimport \{\} from "@\/components\/compat";\s*\n/g, 'import { ');
  content = content.replace(/import \{\s*\nimport \{([^}]*)\} from/g, 'import { $1 } from');
  // Remove empty compat imports
  content = content.replace(/import \{\s*\} from "@\/components\/compat";\n/g, '');

  // ========== FIX BUTTON VARIANT/COLOR PROPS ==========
  // variant="flat" → variant="primary" (most common v2 "flat" means default/primary)
  content = content.replace(/variant="flat"/g, 'variant="primary"');
  // variant="light" → variant="ghost"
  content = content.replace(/variant="light"/g, 'variant="ghost"');
  // variant="bordered" → variant="outline"
  content = content.replace(/variant="bordered"/g, 'variant="outline"');
  // variant="solid" → remove (default is solid)
  content = content.replace(/ variant="solid"/g, '');

  // Button color props → variant (only for Button contexts)
  // color="primary" on Button → remove (use variant instead)
  content = content.replace(/<Button([^>]*) color="primary"/g, '<Button$1 variant="primary"');
  content = content.replace(/<Button([^>]*) color="secondary"/g, '<Button$1 variant="secondary"');
  content = content.replace(/<Button([^>]*) color="danger"/g, '<Button$1 variant="danger"');
  // If Button has both variant="primary" and variant="primary" from color replacement, deduplicate
  content = content.replace(/variant="primary"([^"]*)variant="primary"/g, 'variant="primary"$1');

  // ========== FIX CARD PROPS ==========
  // Remove isHoverable from Card
  content = content.replace(/ isHoverable/g, '');
  // Remove shadow props from Card components
  content = content.replace(/ shadow="[^"]*"/g, '');
  content = content.replace(/ shadow=\{[^}]*\}/g, '');

  // ========== FIX AVATAR PROPS ==========
  // isBordered on Avatar → className="border-2 border-primary" or just remove
  content = content.replace(/<Avatar([^>]*) isBordered/g, '<Avatar$1 className="border-2 border-default-300"');

  // ========== FIX CHIPS/BADGES ==========
  // Chip variant="flat" → variant="default" or just remove
  content = content.replace(/<Chip([^>]*) variant="flat"/g, '<Chip$1 variant="default"');

  // ========== FIX MODAL ==========
  // ModalContent → ModalDialog (already done in earlier migration, but verify)
  content = content.replace(/ModalContent/g, 'ModalDialog');

  // ========== FIX SELECT → native <select> ==========
  // Replace HeroUI Select with native select
  // <Select label="..." selectedKey={value} onSelectionChange={handler}> with native
  content = content.replace(
    /<Select\s+label="([^"]+)"\s+selectedKey=\{([^}]+)\}\s+onSelectionChange=\{([^}]+)\}/g,
    '<select value={$2} onChange={(e) => $3(e.target.value)} className="w-full border border-default-300 rounded-lg px-3 py-2 bg-transparent text-foreground"'
  );
  content = content.replace(
    /<Select\s+label="([^"]+)"\s+selectedKey=\{([^}]+)\}\s+onSelectionChange=\{([^}]+)\}\s+className="([^"]*)"/g,
    '<select value={$2} onChange={(e) => $3(e.target.value)} className="$4 border border-default-300 rounded-lg px-3 py-2 bg-transparent text-foreground"'
  );
  // Generic Select with any props → native select
  content = content.replace(
    /<Select\s+label="([^"]+)"\s+selectedKey=\{([^}]+)\}\s+onSelectionChange=\{([^}]+)\}\s*\n\s*className="([^"]*)"/g,
    '<select value={$2} onChange={(e) => $3(e.target.value)} className="$4 border border-default-300 rounded-lg px-3 py-2 bg-transparent text-foreground"'
  );
  // Replace <SelectItem ... >Label</SelectItem> with <option value="...">Label</option>
  content = content.replace(/<SelectItem\s+key="([^"]+)"[^>]*>([^<]*)<\/SelectItem>/g, '<option value="$1">$2</option>');
  content = content.replace(/<SelectItem\s+key=\{([^}]+)\}[^>]*>([\s\S]*?)<\/SelectItem>/g, '<option value={$1}>$2</option>');
  // Fix corrupted <  key="...">...</ > patterns
  content = content.replace(/<  key="([^"]+)">([^<]*)<\s+>/g, '<option value="$1">$2</option>');
  content = content.replace(/<  key=\{([^}]+)\}>([^<]*)<\s+>/g, '<option value={$1}>$2</option>');
  content = content.replace(/<  key="([^"]+)">([^<]*)<\/ >/g, '<option value="$1">$2</option>');
  content = content.replace(/<  key=\{([^}]+)\}>([^<]*)<\/ >/g, '<option value={$1}>$2</option>');
  // Remove closing </Select> and replace with </select>
  content = content.replace(/<\/Select>/g, '</select>');
  // Fix broken </ > (corrupted closing tags)
  content = content.replace(/<\/ >/g, '</option>');

  // ========== FIX SWITCH ==========
  // Switch isSelected → checked, onValueChange → onChange
  content = content.replace(/<Switch([^>]*) isSelected=/g, '<Switch$1 checked=');
  content = content.replace(/<Switch([^>]*) onValueChange=/g, '<Switch$1 onChange=');

  // ========== FIX TABS ==========
  // variant="underlined" → remove (not available in v3)
  content = content.replace(/ variant="underlined"/g, '');

  // ========== FIX MISCELLANEOUS ==========
  // Remove any remaining empty lines from previous edits (multiple consecutive newlines)
  content = content.replace(/\n{3,}/g, '\n\n');

  if (content !== original) {
    fs.writeFileSync(file, content);
    totalChanges++;
    console.log(`FIXED: ${file}`);
  } else {
    console.log(`No changes: ${file}`);
  }
}

console.log(`\nTotal files modified: ${totalChanges}`);
