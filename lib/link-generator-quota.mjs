export function linkGeneratorHourlyQuota(data, amount, now, limit, windowMs) {
  const requested = Number(amount);
  const currentTime = Number(now);
  const maximum = Number(limit);
  const duration = Number(windowMs);
  if (!Number.isInteger(requested) || requested < 1) throw new TypeError('The quota amount must be a positive integer.');
  if (!Number.isFinite(currentTime) || !Number.isFinite(maximum) || !Number.isFinite(duration) || maximum < 1 || duration < 1) {
    throw new TypeError('The hourly quota configuration is invalid.');
  }
  const storedStart = Number(data?.windowStarted || 0);
  const active = storedStart > 0 && storedStart <= currentTime && currentTime - storedStart < duration;
  const windowStarted = active ? storedStart : currentTime;
  const count = active ? Math.max(0, Number(data?.count || 0)) : 0;
  const remaining = Math.max(0, maximum - count);
  return {
    allowed: requested <= remaining,
    count,
    nextCount: count + requested,
    remaining,
    remainingAfter: Math.max(0, remaining - requested),
    retryAfter: active ? Math.max(1, Math.ceil((windowStarted + duration - currentTime) / 1000)) : Math.ceil(duration / 1000),
    windowStarted
  };
}
