const fs = require('fs');

// Files with broken double-import patterns
const files = [
  'app/admin/blog/page.tsx',
  'app/Blog/[slug]/page.tsx',
  'app/Blog/page.tsx',
  'app/diagnostics/page.tsx',
  'app/projects/page.tsx',
];

for (const file of files) {
  let c = fs.readFileSync(file, 'utf8');
  
  // Fix pattern: import {\nimport { X, Y } from "@heroui/react";\n  Z,\n  W,\n} from "lucide-react";
  // Should become: import { X, Y } from "@heroui/react";\nimport {\n  Z,\n  W,\n} from "lucide-react";
  c = c.replace(
    /import \{\nimport \{([^}]+)\} from "@heroui\/react";\n(\s+[\s\S]*?\} from "lucide-react";)/,
    'import { $1 } from "@heroui/react";\nimport {\n$2'
  );
  
  // Also fix: import {\nimport { X, Y } from '@heroui/react';\n  Z,\n  W,\n} from 'lucide-react';
  c = c.replace(
    /import \{\nimport \{([^}]+)\} from '@heroui\/react';\n(\s+[\s\S]*?\} from 'lucide-react';)/,
    "import { $1 } from '@heroui/react';\nimport {\n$2"
  );
  
  fs.writeFileSync(file, c);
  console.log('Fixed: ' + file);
}
