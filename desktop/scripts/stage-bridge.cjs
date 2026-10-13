const { cpSync, mkdirSync, existsSync } = require("node:fs");
const { resolve } = require("node:path");
const { execFileSync } = require("node:child_process");
const repo = resolve(__dirname, "../.."),
  runtime = resolve(__dirname, "../.bridge-runtime");
if (!existsSync(resolve(repo, "dist/desktop-host.js")))
  throw new Error("先运行根项目 npm run build，再打包桌面程序。");
mkdirSync(runtime, { recursive: true });
cpSync(resolve(__dirname,'../electron'),resolve(runtime,'desktop/electron'),{recursive:true});
for (const name of ["package.json", "package-lock.json"])
  cpSync(resolve(repo, name), resolve(runtime, name));
if (!process.env.npm_execpath) throw new Error("请通过 npm run 执行打包脚本。");
execFileSync(
  process.execPath,
  [
    process.env.npm_execpath,
    "ci",
    "--omit=dev",
    "--ignore-scripts",
    "--no-fund",
    "--prefix",
    runtime,
  ],
  { stdio: "inherit" },
);

const { stageLinuxPackage } = require('./stage-linux-package.cjs');
const { version } = require('../package.json');
const linux = stageLinuxPackage({repo,runtime,destination:resolve(__dirname,'../.linux-package'),version});
console.log(`Linux daemon ${linux.version}: ${linux.files} files, Node ${linux.nodeVersion}`);
