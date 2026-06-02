var fs = require('fs');

var COMPAT = [
  'useDisclosure','SelectItem','AvatarGroup',
  'Button','Card','CardContent','CardHeader','CardFooter',
  'Input','TextArea','Select',
  'Modal','ModalDialog','ModalHeader','ModalBody','ModalFooter',
  'Switch','Tabs','Tab','Chip','Badge','Avatar',
  'Table','TableHeader','TableColumn','TableBody','TableRow','TableCell',
  'ProgressBar','Separator','Spinner','Accordion','AccordionItem',
  'Link','Dropdown','DropdownTrigger','DropdownMenu','DropdownItem',
];

function findFiles(dir) {
  var r = [];
  try {
    var items = fs.readdirSync(dir, {withFileTypes: true});
    for (var i = 0; i < items.length; i++) {
      var p = dir + '/' + items[i].name;
      if (items[i].isDirectory() && !items[i].name.startsWith('.') && items[i].name !== 'node_modules')
        r = r.concat(findFiles(p));
      else if (items[i].name.endsWith('.tsx') || items[i].name.endsWith('.ts'))
        r.push(p);
    }
  } catch(e) {}
  return r;
}

var files = findFiles('app').concat(findFiles('components'));
var total = 0;

files.forEach(function(file) {
  try {
    var c = fs.readFileSync(file, 'utf8');
    var orig = c;
    var lines = c.split('\n');
    var compat = [];
    var heroui = [];
    var other = [];

    lines.forEach(function(line) {
      var m = line.match(/^import\s*\{([^}]+)\}\s*from\s*"@heroui\/react";?\s*$/);
      if (m) {
        m[1].split(',').forEach(function(n) {
          n = n.trim();
          if (n) {
            if (COMPAT.indexOf(n) >= 0) compat.push(n);
            else heroui.push(n);
          }
        });
        return;
      }
      other.push(line);
    });

    if (compat.length > 0) {
      var uc = [];
      compat.forEach(function(n) { if (uc.indexOf(n) < 0) uc.push(n); });

      var lastIdx = -1;
      for (var i = 0; i < other.length; i++) {
        if (other[i].trim().indexOf('import ') === 0) lastIdx = i;
      }

      var hasCompat = other.some(function(l) {
        return l.indexOf('from "@/components/compat"') >= 0;
      });

      if (!hasCompat) {
        other.splice(lastIdx + 1, 0, 'import { ' + uc.join(', ') + ' } from "@/components/compat";');
      }

      if (heroui.length > 0) {
        var uh = [];
        heroui.forEach(function(n) { if (uh.indexOf(n) < 0) uh.push(n); });
        var ins = lastIdx + (hasCompat ? 1 : 2);
        other.splice(ins, 0, 'import { ' + uh.join(', ') + ' } from "@heroui/react";');
      }

      c = other.join('\n');
    }

    if (c !== orig) {
      fs.writeFileSync(file, c);
      total++;
      console.log('FIXED: ' + file);
    }
  } catch(e) {
    console.log('ERROR: ' + file + ' - ' + e.message);
  }
});

console.log('\nTotal files fixed: ' + total);
