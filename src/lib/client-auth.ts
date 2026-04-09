export type AuthMeUser = {
  userId?: string;
  name?: string;
  email?: string;
};

export type AuthMeResult = {
  ok: boolean;
  user: AuthMeUser | null;
};

let inFlightAuthMe: Promise<AuthMeResult> | null = null;
let cachedAuthMe: { value: AuthMeResult; expiresAt: number } | null = null;

const AUTH_ME_CACHE_TTL_MS = 10_000;

async function requestAuthMe(): Promise<AuthMeResult> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) {
      return { ok: false, user: null };
    }

    const data = await res.json();
    return { ok: true, user: data.user || null };
  } catch {
    return { ok: false, user: null };
  }
}

export async function getAuthMe(forceRefresh = false): Promise<AuthMeResult> {
  const now = Date.now();

  if (!forceRefresh && cachedAuthMe && cachedAuthMe.expiresAt > now) {
    return cachedAuthMe.value;
  }

  if (!forceRefresh && inFlightAuthMe) {
    return inFlightAuthMe;
  }

  inFlightAuthMe = requestAuthMe()
    .then((value) => {
      cachedAuthMe = { value, expiresAt: Date.now() + AUTH_ME_CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      inFlightAuthMe = null;
    });

  return inFlightAuthMe;
}

export function clearAuthMeCache() {
  cachedAuthMe = null;
  inFlightAuthMe = null;
}
