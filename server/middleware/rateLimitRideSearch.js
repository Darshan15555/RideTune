const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 30;
const requestLog = new Map();

export default function rateLimitRideSearch(req, res, next) {
  const key = req.user?.id || req.ip;
  const now = Date.now();
  const entries = requestLog.get(key) || [];
  const recent = entries.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS) {
    return res.status(429).json({ message: 'Too many search requests. Please try again shortly.' });
  }

  recent.push(now);
  requestLog.set(key, recent);
  return next();
}
