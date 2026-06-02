const fs = require('fs');

// Fix all duplicate variant="..." attributes in JSX across all files
// Pattern: variant="X" ... variant="Y" → keep only the first one
const files = [
  'components/navbar.tsx',
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
  'app/Blog/page.tsx',
  'app/Blog/[slug]/page.tsx',
  'app/Blog/write/page.tsx',
  'app/events/page.tsx',
  'app/events/[id]/page.tsx',
  'app/contact/page.tsx',
  'app/gallery/page.tsx',
  'app/docs/page.tsx',
  'app/about/page.tsx',
  'app/not-found.tsx',
  'app/login/page.tsx',
  'app/register/page.tsx',
  'app/verify-email/page.tsx',
  'app/help-feedback/page.tsx',
  'app/connectivity-check/page.tsx',
  'app/diagnostics/page.tsx',
  'components/RouteError.tsx',
];

let totalFixed = 0;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let c = fs.readFileSync(file, 'utf8');
  let orig = c;

  // Fix: variant="X" ... variant="Y" on same line → remove the second variant
  // Handle: <Button variant="primary" ... variant="primary">
  c = c.replace(/(variant="[^"]*")\s+(\S+\s+)*(variant="[^"]*")/g, (match, first, middle, third) => {
    // Only replace if first and third are different values (keep the more specific one)
    // If same value, just remove the duplicate
    return first;
  });

  // Fix: variant={expr} ... variant={expr} on same line
  c = c.replace(/(variant=\{[^}]+\})\s+(\S+\s+)*(variant=\{[^}]+\})/g, (match, first, middle, third) => {
    return first;
  });

  // Fix: className="X" className="Y" → className="X Y"
  c = c.replace(/className="([^"]*)" className="([^"]*)"/g, (m, a, b) => `className="${a} ${b}"`);
  c = c.replace(/className=\{([^}]+)\} className=\{([^}]+)\}/g, (m, a, b) => `className={${a} ${b}}`);

  // Fix: color="X" color="Y" on same line
  c = c.replace(/(color="[^"]*")\s+(\S+\s+)*(color="[^"]*")/g, (match, first) => first);

  // Fix: shadow="X" shadow="Y" on same line  
  c = c.replace(/(shadow="[^"]*")\s+(\S+\s+)*(shadow="[^"]*")/g, (match, first) => first);

  // Fix any remaining double attributes
  c = c.replace(/(variant="[^"]*")\s+[^>\s]*\s+(variant="[^"]*")/g, '$1');

  if (c !== orig) {
    fs.writeFileSync(file, c);
    totalFixed++;
    console.log(`FIXED: ${file}`);
  }
}

console.log(`\nTotal files fixed: ${totalFixed}`);
