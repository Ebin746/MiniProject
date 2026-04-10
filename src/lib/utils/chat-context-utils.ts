// Purpose: Shared low-level chat utility functions.
// Use this file for auth/session payload parsing, working-memory field parsing,
// stage parsing, and PDF-link normalization in generated replies.
import mongoose from 'mongoose';

type ChatStage = 'sales' | 'kyc' | 'credit' | 'loan_selection' | 'docs' | 'done';

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : ({} as Record<string, unknown>);
}

export function extractUserId(authSession: Record<string, unknown>): string | null {
  const raw = authSession.userId;

  if (typeof raw === 'string' && mongoose.Types.ObjectId.isValid(raw)) {
    return raw;
  }

  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const oid = rec.$oid;
    if (typeof oid === 'string' && mongoose.Types.ObjectId.isValid(oid)) {
      return oid;
    }

    const maybeToString = (raw as { toString?: () => string }).toString;
    if (typeof maybeToString === 'function') {
      const value = maybeToString.call(raw);
      if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
        return value;
      }
    }
  }

  return null;
}

export function isWorkingMemoryToolParseError(error: unknown): boolean {
  const serialized = (() => {
    if (error instanceof Error) {
      const details = JSON.stringify(error, Object.getOwnPropertyNames(error));
      return `${error.message || ''}\n${details}`;
    }
    return String(error ?? '');
  })();

  const lower = serialized.toLowerCase();
  const hasParseFailure = lower.includes('failed to parse tool call arguments as json');
  const hasWorkingMemoryContext =
    lower.includes('updateworkingmemory') ||
    lower.includes('# working memory') ||
    lower.includes('tool_use_failed');

  return hasParseFailure && hasWorkingMemoryContext;
}

export function getWorkingMemoryField(workingMemory: string | null, label: string): string {
  if (!workingMemory) return '';
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`-\\s*${escapedLabel}\\s*:\\s*(.*)`, 'i');
  const match = workingMemory.match(regex);
  return match?.[1]?.trim() || '';
}

export function parseStage(value: string): ChatStage | null {
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'sales' ||
    normalized === 'kyc' ||
    normalized === 'credit' ||
    normalized === 'loan_selection' ||
    normalized === 'docs' ||
    normalized === 'done'
  ) {
    return normalized;
  }
  return null;
}

export function patchBrokenPdfLinks(reply: string, generatedPdfPath: string | null): string {
  if (!generatedPdfPath) {
    return reply
      .replace(/\[[^\]]*\]\(https?:\/\/(?:www\.)?example\.com\/[^)]*\.pdf[^)]*\)/gi, 'download link unavailable')
      .replace(/https?:\/\/(?:www\.)?example\.com\/[^\s)]*\.pdf\b/gi, 'download link unavailable');
  }

  const downloadLabel = 'Download your PDF';

  let patched = reply
    .replace(/\((?:https?:\/\/[^)\s]+)?\/pdfs\/loan_done[^)]*\)/gi, `(${generatedPdfPath})`)
    .replace(/\b(?:https?:\/\/[^\s]+)?\/pdfs\/loan_done\S*/gi, generatedPdfPath);

  patched = patched.replace(
    /\[[^\]]*\]\(((?:https?:\/\/[^)\s]+)?\/pdfs\/[^)\s]+\.pdf(?:\?[^)\s]*)?)\)/gi,
    `[${downloadLabel}](${generatedPdfPath})`
  );

  patched = patched.replace(
    /(^|[\s:])((?:https?:\/\/[^\s)]+)?\/pdfs\/[^\s)]+\.pdf(?:\?[^\s)]*)?)([.,!?])?(?=\s|$)/gi,
    (_match, prefix: string, _url: string, trailingPunctuation?: string) => {
      const safePrefix = prefix || '';
      const safeTrailing = trailingPunctuation || '';
      return `${safePrefix}[${downloadLabel}](${generatedPdfPath})${safeTrailing}`;
    }
  );

  const hasDownloadLink = /\[\s*Download\s+your\s+PDF\s*\]\([^)]*\)/i.test(patched);
  if (!hasDownloadLink) {
    patched = `${patched.trim()}\n\n[${downloadLabel}](${generatedPdfPath})`;
  }

  return patched;
}

export function setWorkingMemoryField(workingMemory: string, label: string, value: string): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fieldRegex = new RegExp(`(-\\s*${escapedLabel}\\s*:\\s*).*$`, 'im');
  if (fieldRegex.test(workingMemory)) {
    return workingMemory.replace(fieldRegex, `$1${value}`);
  }
  return workingMemory;
}
