import {mkdirSync, writeFileSync, copyFileSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {repositoryRoot, userDocRoot, publishedAssets, connectionTable, capabilityTable, validateUserDocs} from './doc-site-content.mjs';

// Public documentation has an explicit source root and asset list. Internal
// specifications, evidence, logs and source files are never copied to the site.
rmSync(resolve(repositoryRoot, 'doc/public/references'), {recursive: true, force: true});
const fragments = resolve(userDocRoot, '_generated'), assets = resolve(userDocRoot, 'public');
rmSync(assets, {recursive: true, force: true});
mkdirSync(fragments, {recursive: true}); mkdirSync(assets, {recursive: true});
writeFileSync(resolve(fragments, 'connection-table.md'), connectionTable());
writeFileSync(resolve(fragments, 'capability-table.md'), capabilityTable());
for (const file of publishedAssets) copyFileSync(resolve(repositoryRoot, 'doc/public', file), resolve(assets, file));
const result = validateUserDocs();
console.log(JSON.stringify({ok: true, ...result, publicAssets: publishedAssets.length, internalPagesPublished: 0, evidenceFilesExported: 0}, null, 2));
