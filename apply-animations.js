const fs = require('fs');
const path = require('path');

const publicDir = __dirname;

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if already injected to prevent duplicates
    if (content.includes('global-animations.js')) {
        return;
    }

    // Determine correct relative path to /js/global-animations.js
    // Public dir depth
    const relativeToPublic = path.relative(publicDir, filePath);
    const depth = relativeToPublic.split(path.sep).length - 1;
    let prefix = '';
    for(let i=0; i<depth; i++){
        prefix += '../';
    }
    const scriptSrc = prefix + 'js/global-animations.js';

    // Insert <script src="/js/global-animations.js"></script> before </body>
    const scriptTag = `\n  <script src="${scriptSrc}"></script>\n`;
    
    if (content.includes('</body>')) {
        content = content.replace('</body>', scriptTag + '</body>');
    } else if (content.includes('</BODY>')) {
        content = content.replace('</BODY>', scriptTag + '</BODY>');
    } else {
        content += scriptTag;
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.html')) {
            processHtmlFile(fullPath);
        }
    }
}

walkDir(publicDir);
console.log('Animation injection complete.');
