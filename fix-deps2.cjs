const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.dependencies = pkg.dependencies || {};
for (const key of Object.keys(pkg.devDependencies || {})) {
  pkg.dependencies[key] = pkg.devDependencies[key];
}
pkg.devDependencies = {};
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
