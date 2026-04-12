import dbConnect from '../../lib/mongodb';
import User from '../../models/User';
import { decryptPII } from '../../lib/security/pii-crypto';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function resolveToolUserId(runtimeContext: unknown): string {
  const rt = asRecord(runtimeContext);
  const direct = rt.userId || rt.resourceId;

  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const nested = asRecord(rt.auth);
  const nestedUser = nested.userId || nested.resourceId;
  if (typeof nestedUser === 'string' && nestedUser.trim()) {
    return nestedUser.trim();
  }

  throw new Error('Missing authenticated user context for secure identity operation.');
}

export async function getVerifiedUserIdentity(userId: string): Promise<{
  hasVerifiedKyc: boolean;
  hasVerifiedPan: boolean;
  pan: string;
  aadhaar: string;
  lastCreditScore: number | null;
  lastFoir: number | null;
}> {
  await dbConnect();
  const user = await User.findById(userId)
    .select('encryptedPan encryptedAadhaar hasVerifiedPan hasVerifiedKyc lastCreditScore lastFoir')
    .lean();

  const encryptedPan = typeof user?.encryptedPan === 'string' ? user.encryptedPan : '';
  const encryptedAadhaar = typeof user?.encryptedAadhaar === 'string' ? user.encryptedAadhaar : '';

  return {
    hasVerifiedKyc: Boolean(user?.hasVerifiedKyc),
    hasVerifiedPan: Boolean(user?.hasVerifiedPan),
    pan: encryptedPan ? decryptPII(encryptedPan).toUpperCase() : '',
    aadhaar: encryptedAadhaar ? decryptPII(encryptedAadhaar).replace(/\s/g, '') : '',
    lastCreditScore: typeof user?.lastCreditScore === 'number' ? user.lastCreditScore : null,
    lastFoir: typeof user?.lastFoir === 'number' ? user.lastFoir : null,
  };
}