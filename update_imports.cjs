const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(srcDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace three.module.js URL with 'three'
  content = content.replace(/['"]https:\/\/unpkg\.com\/three@[^\/]+\/build\/three\.module\.js['"]/g, "'three'");
  
  // Replace examples URL with 'three/examples/jsm/'
  content = content.replace(/['"]https:\/\/unpkg\.com\/three@[^\/]+\/examples\/jsm\/(.*?)['"]/g, "'three/examples/jsm/$1'");

  // Replace three/addons/ with three/examples/jsm/ for consistency and compatibility
  content = content.replace(/['"]three\/addons\/(.*?)['"]/g, "'three/examples/jsm/$1'");

  fs.writeFileSync(filePath, content);
}
console.log("Updated imports");
