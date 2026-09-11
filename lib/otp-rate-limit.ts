const otpCooldowns = new Map<string, number>();

const COOLDOWN_MS = 60_000;

export function checkOtpCooldown(email: string): {
  allowed: boolean;
  remainingSeconds: number;
} {
  const lastSent = otpCooldowns.get(email);
  if (!lastSent) return { allowed: true, remainingSeconds: 0 };

  const elapsed = Date.now() - lastSent;
  if (elapsed >= COOLDOWN_MS) return { allowed: true, remainingSeconds: 0 };

  return {
    allowed: false,
    remainingSeconds: Math.ceil((COOLDOWN_MS - elapsed) / 1000),
  };
}

export function recordOtpSent(email: string) {
  otpCooldowns.set(email, Date.now());

  // Prevent memory leak — purge entries older than 10 min
  if (otpCooldowns.size > 1000) {
    const now = Date.now();
    for (const [key, val] of otpCooldowns) {
      if (now - val > 600_000) otpCooldowns.delete(key);
    }
  }
}
