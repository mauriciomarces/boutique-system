const crypto = require('node:crypto');
const net = require('node:net');
const { ipKeyGenerator } = require('express-rate-limit');

function getTrustedClientIp(req, expectedSecret) {
  const providedSecret =
    req.get?.('x-internal-service-key') ??
    req.headers?.['x-internal-service-key'];
  const forwardedIp =
    req.get?.('x-client-ip') ?? req.headers?.['x-client-ip'];

  if (
    typeof expectedSecret !== 'string' ||
    !expectedSecret ||
    typeof providedSecret !== 'string' ||
    Buffer.byteLength(providedSecret) !== Buffer.byteLength(expectedSecret) ||
    !crypto.timingSafeEqual(
      Buffer.from(providedSecret),
      Buffer.from(expectedSecret),
    ) ||
    typeof forwardedIp !== 'string' ||
    net.isIP(forwardedIp) === 0
  ) {
    return null;
  }

  return forwardedIp;
}

function getClientIpRateLimitKey(req, expectedSecret) {
  const clientIp = getTrustedClientIp(req, expectedSecret) || req.ip;
  return ipKeyGenerator(clientIp);
}

module.exports = { getClientIpRateLimitKey, getTrustedClientIp };
