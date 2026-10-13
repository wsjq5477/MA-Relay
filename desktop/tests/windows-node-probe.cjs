const fs=require('node:fs'),path=require('node:path');
fs.writeFileSync(path.resolve(__dirname,'../../artifacts/I04-windows-node.json'),JSON.stringify({platform:process.platform,node:process.version,executable:process.execPath,argv:process.argv},null,2));
