import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {publishedFiles, repositoryRoot, validatePublicPage, validateUserDocs, connectionTable, capabilityTable} from '../scripts/doc-site-content.mjs';
import {checkDocSite} from '../scripts/check-doc-site.mjs';

test('公开页面只包含用户文档，七种产品均有独立章节', () => {
  assert.equal(validateUserDocs().pages, 18);
  for (const name of ['claude', 'codex', 'opencode', 'hermes', 'pi', 'dsh', 'opendesk']) assert.ok(publishedFiles.has(`agents/${name}.md`));
  for (const file of publishedFiles) assert.doesNotMatch(file, /test-report|iterations|archive|modules/);
});
test('接入方式和能力表分别保持方向及 DSH 服务边界', () => {
  const methods = connectionTable(), capabilities = capabilityTable();
  assert.match(methods, /\| Claude Code \| ✓ \| — \| ✓ \|/);
  assert.match(methods, /\| OpenCode \| 启动服务 \| HTTP \| ✓ \|/);
  for (const name of ['DSH Desktop', 'DSH Web']) {
    assert.ok(methods.includes(`| ${name} | — | HTTP | ✓ | — | — | — |`));
    // MCP is the native Agent-to-Bridge direction; HTTP drives execution.
    // Native config support never implies hosted task/squad binding.
    assert.ok(capabilities.includes(`| ${name} | ✓ | ✓ | ✓ | ✓ | ✓ | — |`));
  }
  assert.ok(methods.includes('| DSH CLI | ✓ | — | ✓ | — | — | — |'));
  // Independent client support remains separate from hosted task injection.
  assert.ok(capabilities.includes('| Hermes | ✓ | ✓ | ✓ | ✓ | ✓ | — |'));
  assert.ok(capabilities.includes('| Pi | ✓ | ✓ | ✓ | ✓ | ✓ | — |'));
  assert.ok(methods.includes('| Pi | ✓ | — | ✓ | — | — | — |'));
  assert.equal(methods.trim().split('\n').length, 12);
  assert.equal(capabilities.trim().split('\n').length, 12);
});
test('正文拒绝内部编号、过程、仓库链接及未许可 include', () => {
  for (const text of ['# M06-F01', '# CT-06', '查看测试报告', '[材料](../iterations/README.md)', '[源码](../../desktop/electron/dsh-worker.cjs)', '<!--@include: ../modules/06-native-adapters/design.md-->']) {
    assert.throws(() => validatePublicPage('index.md', text));
  }
  assert.doesNotThrow(() => validatePublicPage('index.md', '[DSH](agents/dsh.md)'));
  assert.doesNotThrow(() => validatePublicPage('index.md', '<!--@include: ./_generated/connection-table.md-->'));
});
test('HTML / 引用式链接不能绕过正文链接检查', () => {
  for (const text of ['<a href="/iterations/">内部</a>', '[资料][internal]\n[internal]: ../README.md', '<iframe src="/modules/06-native-adapters/design" />']) assert.throws(() => validatePublicPage('index.md', text));
});
test('发布审计对生成目录执行独立白名单与内容检查', () => {
  const folder = mkdtempSync(resolve(tmpdir(), 'agentbridge-public-docs-'));
  try {
    for (const file of [...publishedFiles].map(name => name.replace(/\.md$/, '.html')).concat('404.html')) {
      const target = resolve(folder, file); mkdirSync(resolve(target, '..'), {recursive: true});
      writeFileSync(target, file === 'index.html' ? '原生 CLI 原生 API MCP ACP 插件 SDK' : file === 'agents/dsh.html' ? 'DSH CLI DSH Windows Desktop DSH Linux / WSL Web 为什么采用原生 API' : '用户说明');
    }
    writeFileSync(resolve(folder, 'agentbridge.png'), 'fixture');
    assert.equal(checkDocSite(folder).htmlPages, 19);
    mkdirSync(resolve(folder, 'assets'), {recursive: true});
    writeFileSync(resolve(folder, 'assets/index.C2f-I31F.js'), 'export {};');
    writeFileSync(resolve(folder, 'assets/importer.js'), 'import "./index.C2f-I31F.js";');
    assert.equal(checkDocSite(folder).htmlPages, 19);
    writeFileSync(resolve(folder, 'assets/index.C2f-I31F.js'), 'M06-F01');
    assert.throws(() => checkDocSite(folder), /内部材料/);
    rmSync(resolve(folder, 'assets/index.C2f-I31F.js')); rmSync(resolve(folder, 'assets/importer.js'));

    writeFileSync(resolve(folder, 'test-report.html'), '内部');
    assert.throws(() => checkDocSite(folder), /未登记页面/);
    rmSync(resolve(folder, 'test-report.html'));
    mkdirSync(resolve(folder, 'assets'), {recursive: true});
    writeFileSync(resolve(folder, 'assets/search.js'), 'M06-F01');
    assert.throws(() => checkDocSite(folder), /搜索资源混入内部材料/);
    rmSync(resolve(folder, 'assets/search.js'));
    mkdirSync(resolve(folder, 'references'));
    writeFileSync(resolve(folder, 'references/raw.log'), 'internal');
    assert.throws(() => checkDocSite(folder), /非公开材料/);
  } finally {rmSync(folder, {recursive: true, force: true});}
});
test('站点配置使用隔离源目录，资源准备不再扫描仓库引用', () => {
  const config = readFileSync(resolve(repositoryRoot, 'doc/.vitepress/config.mts'), 'utf8');
  assert.match(config, /srcDir: 'user'/);
  assert.match(config, /publishedFiles\.has\(data.relativePath\)/);
  assert.doesNotMatch(config, /scanModules|scanIterations/);
  const prepare = readFileSync(resolve(repositoryRoot, 'scripts/prepare-doc-site.mjs'), 'utf8');
  assert.match(prepare, /publishedAssets/);
  assert.doesNotMatch(prepare, /matchAll|collectReferences/);
});
