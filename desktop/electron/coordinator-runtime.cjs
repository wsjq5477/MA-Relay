const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { workerRuntime } = require('./worker-runtime.cjs');
const { ensurePrivateDirectory } = require('./private-directory.cjs');

// Freeze the complete backend, not just electron.exe: portable extraction paths
// disappear as soon as the last window closes.
function coordinatorRuntime(options) {
  const source = options.bridgeDirectory;
  const version = options.version || '0.6.0-alpha.1';
  const modules = path.join(source, 'node_modules');
  const stamp = createHash('sha256');
  for (const name of fs.readdirSync(path.join(source, 'desktop/electron')).filter(n => n.endsWith('.cjs')).sort())
    stamp.update(name).update(fs.readFileSync(path.join(source, 'desktop/electron', name)));
  function digestDirectory(directory) {
    for (const item of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
      const file=path.join(directory,item.name);
      if(item.isDirectory()) digestDirectory(file);
      else if(item.isFile()) stamp.update(file.slice(source.length)).update(fs.readFileSync(file));
    }
  }
  digestDirectory(path.join(source,'dist'));
  stamp.update(fs.readFileSync(path.join(source, 'package.json')));
  const target = path.join(options.directory, 'coordinator', 'versions', `${version}-${stamp.digest('hex').slice(0,12)}`);
  const manifest = path.join(target, 'coordinator-runtime.json');
  if (!fs.existsSync(manifest)) {
    ensurePrivateDirectory(path.dirname(target));
    const stage = target + '.' + randomUUID() + '.tmp';
    fs.mkdirSync(stage, {mode:0o700});
    try {
      for (const name of ['dist','desktop/electron','package.json'])
        fs.cpSync(path.join(source,name),path.join(stage,name),{recursive:true});
      if (fs.existsSync(path.join(source,'bootstrap.sh')))
        fs.copyFileSync(path.join(source,'bootstrap.sh'),path.join(stage,'bootstrap.sh'));
      // Copy only the production dependency closure when developing from a
      // checkout. Packaged resources already contain exactly this closure.
      const queue = Object.keys(JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8')).dependencies || {});
      const seen = new Set();
      while (queue.length) {
        const name = queue.shift(); if (seen.has(name)) continue; seen.add(name);
        const from = path.join(modules,name);
        if (!fs.existsSync(from)) throw Object.assign(new Error('后台依赖不完整，请重新构建程序。'),{code:'COORDINATOR_RUNTIME'});
        const pkg = JSON.parse(fs.readFileSync(path.join(from,'package.json'),'utf8'));
        fs.cpSync(from,path.join(stage,'node_modules',name),{recursive:true,dereference:true});
        queue.push(...Object.keys(pkg.dependencies || {}));
      }
      if (options.packageDirectory && fs.existsSync(options.packageDirectory))
        fs.cpSync(options.packageDirectory,path.join(stage,'linux-package'),{recursive:true});
      fs.writeFileSync(path.join(stage,'coordinator-runtime.json'),JSON.stringify({version,createdAt:new Date().toISOString()}),{mode:0o600});
      try { fs.renameSync(stage,target); }
      catch(error) { if (!fs.existsSync(manifest)) throw error; fs.rmSync(stage,{recursive:true,force:true}); }
    } catch(error) { fs.rmSync(stage,{recursive:true,force:true}); throw error; }
  }
  return {directory:target, executable:workerRuntime(path.join(options.directory,'coordinator')),
    entry:path.join(target,'desktop/electron/coordinator.cjs'),packageDirectory:path.join(target,'linux-package')};
}
module.exports = {coordinatorRuntime};
