import type { PinnedTeamDocument } from './team-types';

export async function verifyPinnedDocument(value: PinnedTeamDocument, runId: string, documentId: string, revision: number) {
  if (value.runId !== runId || value.documentId !== documentId || value.revision !== revision ||
      !Number.isSafeInteger(value.currentRevision) || value.currentRevision < revision ||
      typeof value.title !== 'string' || typeof value.content !== 'string' ||
      !/^[a-f0-9]{64}$/.test(value.contentSha256 || ''))
    throw new Error('后台未返回指定文档版本，请升级后台后重试；原共享文档仍可阅读。');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value.content));
  const actual = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  if (actual !== value.contentSha256) throw new Error('文档正文与版本摘要不一致，请重新读取。');
  return value;
}

export function documentMarkdown(value: PinnedTeamDocument) {
  return '# ' + value.title.replace(/[\r\n]/g, ' ') + '\n\n' +
    '文档修订：' + value.revision + '（读取时最新修订：' + value.currentRevision + '）\n\n' +
    '引用：`team-document:' + value.documentId + ':' + value.revision + '`\n\n' +
    '正文 SHA-256：`' + value.contentSha256 + '`\n\n---\n\n' + value.content + '\n';
}

export function materialFilename(title: string, suffix: string) {
  const safe = title.replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '-').replace(/[. ]+$/g, '').slice(0, 70) || '未命名';
  return '公共材料-' + safe + '-' + suffix + '.md';
}

export function downloadMarkdown(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
