const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/ProjectDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/amber/g, 'orange');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced colors in ProjectDashboard.tsx');
