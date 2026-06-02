const fs = require('fs');

function findFiles(dir) {
  const r = [];
  try {
    const items = fs.readdirSync(dir, {withFileTypes:true});
    for (const i of items) {
      const p = dir + '/' + i.name;
      if (i.isDirectory() && !i.name.startsWith('.') && i.name !== 'node_modules') {
        r.push(...findFiles(p));
      } else if (i.name.endsWith('.tsx') || i.name.endsWith('.ts')) {
        r.push(p);
      }
    }
  } catch(e) {}
  return r;
}

const files = [...findFiles('app'), ...findFiles('components')];
const renames = {
  'CardBody': 'CardContent',
  'Divider': 'Separator',
  'Progress': 'ProgressBar',
  'Textarea': 'TextArea',
  'ModalContent': 'ModalDialog',
};

let total = 0;
for (const f of files) {
  let c = fs.readFileSync(f, 'utf8');
  let orig = c;
  
  // Replace component names everywhere in the file
  // But be careful not to rename inside string content (JSX text, etc.)
  for (const [from, to] of Object.entries(renames)) {
    // Replace in import statements and JSX tags
    // Use word boundary to avoid partial matches
    const regex = new RegExp('\\b' + from + '\\b', 'g');
    c = c.replace(regex, to);
  }
  
  if (c !== orig) {
    fs.writeFileSync(f, c);
    total++;
    console.log('Fixed: ' + f);
  }
}

console.log('\nTotal files fixed: ' + total);
