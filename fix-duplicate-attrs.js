const fs = require('fs');

const files = [
  'app/admin/blog/page.tsx',
  'app/admin/events/page.tsx',
  'app/admin/projects/page.tsx',
  'app/admin/sponsors/page.tsx',
  'app/dashboard/page.tsx',
  'app/profile/page.tsx',
  'app/projects/page.tsx',
  'app/settings/page.tsx',
  'app/sponsors/page.tsx',
  'app/team/page.tsx',
  'components/navbar.tsx'
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let c = fs.readFileSync(file, 'utf8');
  let fixed = 0;

  // Fix duplicate className="..." on same line
  c = c.replace(/(className="[^"]*") className="([^"]*)"/g, (match, first, second) => {
    fixed++;
    return first.slice(0, -1) + ' ' + second;
  });

  // Fix duplicate className={...} on same line
  c = c.replace(/(className=\{[^}]+\}) className=\{([^}]+)\}/g, (match, first, second) => {
    fixed++;
    return first.slice(0, -1) + ' ' + second + '}';
  });

  if (fixed > 0) {
    fs.writeFileSync(file, c);
    console.log(`Fixed ${fixed} duplicate attrs in ${file}`);
  }
}

console.log('Done fixing duplicate attributes');
