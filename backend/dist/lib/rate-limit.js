"use strict";
/**
 * Rate Limiting Utility
 * Provides request rate limiting to prevent abuse and DoS attacks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyRateLimit = applyRateLimit;
exports.checkRateLimit = checkRateLimit;
const ratelimit_1 = require("@upstash/ratelimit");
const redis_1 = require("@upstash/redis");
const server_1 = require("next/server");
const config_1 = require("./config");
const debug_logger_1 = require("./debug-logger");
// Initialize Redis client (will be undefined if not configured)
let redis;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new redis_1.Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
}
// Create rate limiters
let generalLimiter;
let authLimiter;
if (redis) {
    // General API rate limiter
    generalLimiter = new ratelimit_1.Ratelimit({
        redis,
        limiter: ratelimit_1.Ratelimit.slidingWindow(config_1.config.rateLimit.maxRequests, `${config_1.config.rateLimit.windowMs}ms`),
        analytics: true,
        prefix: 'ratelimit:general',
    });
    // Stricter rate limiter for authentication endpoints
    authLimiter = new ratelimit_1.Ratelimit({
        redis,
        limiter: ratelimit_1.Ratelimit.slidingWindow(config_1.config.rateLimit.auth.maxRequests, `${config_1.config.rateLimit.auth.windowMs}ms`),
        analytics: true,
        prefix: 'ratelimit:auth',
    });
}
/**
 * Get client IP address from request
 */
function getClientIp(request) {
    // Try to get real IP from headers (for reverse proxies)
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp;
    }
    // Fallback to localhost (Next.js 15+ doesn't have request.ip property)
    return '127.0.0.1';
}
/**
 * Check if endpoint is an authentication endpoint
 */
function isAuthEndpoint(pathname) {
    const authPaths = [
        '/api/auth',
        '/api/login',
        '/api/register',
        '/api/signup',
        '/api/password',
        '/api/reset',
    ];
    return authPaths.some((path) => pathname.startsWith(path));
}
/**
 * Apply rate limiting to a request
 * Returns null if request is allowed, or a NextResponse with 429 status if rate limited
 */
async function applyRateLimit(request) {
    // Skip rate limiting if disabled
    if (!config_1.config.rateLimit.enabled) {
        return null;
    }
    // Skip if Redis is not configured
    if (!redis || !generalLimiter || !authLimiter) {
        debug_logger_1.logger.warn('Rate limiting skipped: Redis not configured', { action: 'rate_limit' });
        return null;
    }
    const ip = getClientIp(request);
    const pathname = request.nextUrl.pathname;
    // Determine which limiter to use
    const limiter = isAuthEndpoint(pathname) ? authLimiter : generalLimiter;
    const limiterType = isAuthEndpoint(pathname) ? 'auth' : 'general';
    try {
        const { success, limit, remaining, reset } = await limiter.limit(ip);
        // Log rate limit check
        debug_logger_1.logger.debug(`Rate limit check: ${success ? 'allowed' : 'blocked'}`, {
            action: 'rate_limit',
            ip,
            pathname,
            limiter: limiterType,
            remaining,
            reset: new Date(reset).toISOString(),
        });
        if (!success) {
            debug_logger_1.logger.warn(`Rate limit exceeded`, {
                action: 'rate_limit_exceeded',
                ip,
                pathname,
                limiter: limiterType,
            });
            return new server_1.NextResponse(JSON.stringify({
                error: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil((reset - Date.now()) / 1000),
            }), {
                status: 429,
                headers: {
                    'Content-Type': 'application/json',
                    'X-RateLimit-Limit': limit.toString(),
                    'X-RateLimit-Remaining': remaining.toString(),
                    'X-RateLimit-Reset': reset.toString(),
                    'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
                },
            });
        }
        // Add rate limit headers to successful requests
        request.headers.set('X-RateLimit-Limit', limit.toString());
        request.headers.set('X-RateLimit-Remaining', remaining.toString());
        request.headers.set('X-RateLimit-Reset', reset.toString());
        return null; // Request is allowed
    }
    catch (error) {
        // ALERT: Rate limiting unavailable - failing open
        // In production, this means ALL rate limits are bypassed
        debug_logger_1.logger.error('[RATE_LIMIT_FAILURE] Redis connection failed - rate limiting disabled', {
            action: 'rate_limit',
            pathname,
            ip,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
        }, error);
        return null; // Allow request on error (fail open)
    }
}
/**
 * Check rate limit for a specific identifier (e.g., user ID)
 * Useful for custom rate limiting logic
 */
async function checkRateLimit(identifier, maxRequests = 100, windowMs = 60000) {
    if (!redis) {
        return { success: true, limit: maxRequests, remaining: maxRequests, reset: Date.now() + windowMs };
    }
    const customLimiter = new ratelimit_1.Ratelimit({
        redis,
        limiter: ratelimit_1.Ratelimit.slidingWindow(maxRequests, `${windowMs}ms`),
        analytics: true,
        prefix: `ratelimit:custom:${identifier}`,
    });
    const result = await customLimiter.limit(identifier);
    return result;
}
