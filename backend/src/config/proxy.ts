/**
 * Railway places one reverse proxy in front of the Express service.
 *
 * Trust exactly that one hop in production so Express can safely derive the
 * client IP from X-Forwarded-For for rate limiting. Local development keeps
 * proxy trust disabled because requests normally arrive directly at Express.
 */
export function getTrustProxySetting(nodeEnv = process.env.NODE_ENV): number | false {
  return nodeEnv === 'production' ? 1 : false;
}
