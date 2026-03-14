const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/ProjectDashboard.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Extract the content of activeTab === 'hse'
const activeTabHseRegex = /if \(activeTab === 'hse'\) \{\s*return \(\s*<div className="space-y-6 animate-in fade-in duration-300">([\s\S]*?)<\/div>\s*\);\s*\}/;
const match = content.match(activeTabHseRegex);

if (match) {
  const hseContent = match[1];
  
  // 2. Remove activeTab === 'hse' block
  content = content.replace(activeTabHseRegex, '');
  
  // 3. Find manpowerTab === 'hse' block
  const manpowerTabHseRegex = /\{manpowerTab === 'hse' && \(\s*<div className="space-y-6">([\s\S]*?)<\/div>\s*\)\}/;
  const manpowerMatch = content.match(manpowerTabHseRegex);
  
  if (manpowerMatch) {
    const oldManpowerHseContent = manpowerMatch[1];
    
    // Combine them
    const newManpowerHseContent = `{manpowerTab === 'hse' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              \${oldManpowerHseContent}
              \${hseContent}
            </div>
          )}`;
          
    content = content.replace(manpowerTabHseRegex, newManpowerHseContent);
  }
}

// 4. Remove the sidebar menu item for HSE
const sidebarItemRegex = /<button\s+onClick=\{\(\) => setActiveTab\('hse'\)\}\s+className=\{`whitespace-nowrap px-5 py-2\.5 rounded-xl flex items-center gap-2 transition-all font-medium \$\{activeTab === 'hse' \? 'bg-emerald-50 text-emerald-700 shadow-sm' : 'text-slate-600 hover:bg-slate-50'\}`\}\s*>\s*<ShieldCheck size=\{18\}\/> An toàn LĐ \(HSE\)\s*<\/button>/;
content = content.replace(sidebarItemRegex, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Moved HSE tab to manpower sub-tab');
