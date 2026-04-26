"use strict";
/**
 * Server-Side Guards for API Routes
 *
 * These guards provide consistent permission checking and error handling
 * for API routes. They throw standard errors that can be caught and
 * converted to appropriate HTTP responses.
 *
 * Usage in API routes:
 * ```typescript
 * import { requirePermission, requireAuthentication } from '@/lib/server-guards';
 *
 * export async function POST(request: Request) {
 *   const user = await requireAuthentication();
 *   await requirePermission(user, Permission.MANAGE_PROJECTS, { accountId });
 *   // ... rest of handler
 * }
 * ```
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenError = exports.PermissionError = exports.AuthenticationError = void 0;
exports.requireAuthentication = requireAuthentication;
exports.getAuthenticatedUser = getAuthenticatedUser;
exports.requirePermission = requirePermission;
exports.requireAnyPermission = requireAnyPermission;
exports.requireAllPermissions = requireAllPermissions;
exports.requireSuperadmin = requireSuperadmin;
exports.requireAssignedRole = requireAssignedRole;
exports.requireOwnershipOrPermission = requireOwnershipOrPermission;
exports.handleGuardError = handleGuardError;
exports.withErrorHandling = withErrorHandling;
exports.withApiRoute = withApiRoute;
exports.requireAuthAndPermission = requireAuthAndPermission;
exports.requireAuthAndAnyPermission = requireAuthAndAnyPermission;
exports.requireAuthAndSuperadmin = requireAuthAndSuperadmin;
const server_1 = require("next/server");
const supabase_server_1 = require("./supabase-server");
const permission_checker_1 = require("./permission-checker");
const debug_logger_1 = require("./debug-logger");
// ================================================================================
// CUSTOM ERROR TYPES
// ================================================================================
class AuthenticationError extends Error {
    constructor(message = 'Authentication required') {
        super(message);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class PermissionError extends Error {
    constructor(message = 'Insufficient permissions', permission, context) {
        super(message);
        this.name = 'PermissionError';
        this.permission = permission;
        this.context = context;
    }
}
exports.PermissionError = PermissionError;
class ForbiddenError extends Error {
    constructor(message = 'Forbidden') {
        super(message);
        this.name = 'ForbiddenError';
    }
}
exports.ForbiddenError = ForbiddenError;
// ================================================================================
// AUTHENTICATION GUARDS
// ================================================================================
/**
 * Require that the user is authenticated
 * Throws AuthenticationError if not authenticated
 * @param request - Optional NextRequest for API routes
 * @returns UserWithRoles profile
 */
async function requireAuthentication(request) {
    try {
        if (!request) {
            throw new AuthenticationError('Authentication failed - request parameter required');
        }
        // Use admin.auth.getUser(token) — the only reliable way in Express context
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            throw new AuthenticationError('You must be logged in to access this resource');
        }
        // Fetch full profile using admin client
        const { createAdminSupabaseClient } = await Promise.resolve().then(() => __importStar(require('./supabase-server')));
        const admin = createAdminSupabaseClient();
        if (!admin)
            throw new AuthenticationError('Supabase not configured');
        const { data: userProfile, error: profileError } = await admin
            .from('user_profiles')
            .select(`*, user_roles!user_id(
        id, role_id, assigned_at, assigned_by,
        roles!role_id(
          *, departments(*)
        )
      )`)
            .eq('id', user.id)
            .single();
        if (profileError || !userProfile) {
            throw new AuthenticationError('User profile not found');
        }
        return userProfile;
    }
    catch (error) {
        if (error instanceof AuthenticationError)
            throw error;
        throw new AuthenticationError('Authentication failed');
    }
}
/**
 * Optionally get authenticated user (doesn't throw if not authenticated)
 * @returns UserWithRoles profile or null
 */
async function getAuthenticatedUser() {
    try {
        return await requireAuthentication();
    }
    catch (_error) {
        return null;
    }
}
// ================================================================================
// PERMISSION GUARDS
// ================================================================================
/**
 * Require that the user has a specific permission
 * Throws PermissionError if user doesn't have permission
 * @param userProfile - User profile with roles
 * @param permission - Required permission
 * @param context - Optional context (project, account, department)
 * @param supabaseClient - Optional Supabase client for context-aware checks (REQUIRED for server-side)
 */
async function requirePermission(userProfile, permission, context, supabaseClient) {
    try {
        const hasPermission = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permission, context, supabaseClient);
        if (!hasPermission) {
            debug_logger_1.logger.warn('Permission denied', {
                userId: userProfile.id,
                permission,
                context
            });
            throw new PermissionError(`You don't have permission to perform this action`, permission, context);
        }
    }
    catch (error) {
        if (error instanceof PermissionError) {
            throw error;
        }
        debug_logger_1.logger.error('Exception in requirePermission', { permission, context }, error);
        throw new PermissionError('Permission check failed', permission, context);
    }
}
/**
 * Require that the user has ANY of the specified permissions
 * @param userProfile - User profile with roles
 * @param permissions - Array of permissions (user needs at least one)
 * @param context - Optional context
 * @param supabaseClient - Optional Supabase client for context-aware checks (REQUIRED for server-side)
 */
async function requireAnyPermission(userProfile, permissions, context, supabaseClient) {
    for (const permission of permissions) {
        try {
            await requirePermission(userProfile, permission, context, supabaseClient);
            return; // Success - user has at least one permission
        }
        catch (_error) {
            // Continue checking other permissions
        }
    }
    // None of the permissions matched
    debug_logger_1.logger.warn('None of required permissions granted', {
        userId: userProfile.id,
        permissions,
        context
    });
    throw new PermissionError(`You don't have any of the required permissions`, permissions[0], // Just use first permission for error tracking
    context);
}
/**
 * Require that the user has ALL of the specified permissions
 * @param userProfile - User profile with roles
 * @param permissions - Array of permissions (user needs all of them)
 * @param context - Optional context
 * @param supabaseClient - Optional Supabase client for context-aware checks (REQUIRED for server-side)
 */
async function requireAllPermissions(userProfile, permissions, context, supabaseClient) {
    for (const permission of permissions) {
        await requirePermission(userProfile, permission, context, supabaseClient);
    }
}
// ================================================================================
// ROLE GUARDS
// ================================================================================
/**
 * Require that the user is a superadmin
 * Throws ForbiddenError if not superadmin
 * @param userProfile - User profile with roles
 */
async function requireSuperadmin(userProfile) {
    if (!(0, permission_checker_1.isSuperadmin)(userProfile)) {
        debug_logger_1.logger.warn('Superadmin access required but user is not superadmin', {
            userId: userProfile.id
        });
        throw new ForbiddenError('Superadmin access required');
    }
}
/**
 * Require that the user is NOT unassigned
 * Throws ForbiddenError if user has no roles or only Unassigned role
 * @param userProfile - User profile with roles
 */
async function requireAssignedRole(userProfile) {
    if (!userProfile.user_roles || userProfile.user_roles.length === 0) {
        throw new ForbiddenError('You must be assigned a role to access this resource');
    }
    // Check if user has only Unassigned role
    if (userProfile.user_roles.length === 1) {
        const role = userProfile.user_roles[0].roles;
        if (role.is_system_role && role.name.toLowerCase() === 'unassigned') {
            throw new ForbiddenError('You must be assigned a role to access this resource');
        }
    }
}
// ================================================================================
// RESOURCE OWNERSHIP GUARDS
// ================================================================================
/**
 * Require that the user owns a resource or has permission to access it
 * @param userProfile - User profile with roles
 * @param resourceOwnerId - ID of the user who owns the resource
 * @param overridePermission - Optional permission that grants access regardless of ownership
 */
async function requireOwnershipOrPermission(userProfile, resourceOwnerId, overridePermission) {
    // Check ownership
    if (userProfile.id === resourceOwnerId) {
        return;
    }
    // Check override permission if provided
    if (overridePermission) {
        await requirePermission(userProfile, overridePermission);
        return;
    }
    // Neither ownership nor permission
    throw new ForbiddenError('You can only access your own resources');
}
// ================================================================================
// ERROR RESPONSE HELPERS
// ================================================================================
/**
 * Convert guard errors to Next.js responses
 * Use this in catch blocks of API routes
 * @param error - The error thrown
 * @returns NextResponse with appropriate status code and message
 */
function handleGuardError(error) {
    if (error instanceof AuthenticationError) {
        return server_1.NextResponse.json({ error: error.message, code: 'UNAUTHENTICATED' }, { status: 401 });
    }
    if (error instanceof PermissionError) {
        return server_1.NextResponse.json({
            error: error.message,
            code: 'PERMISSION_DENIED',
        }, { status: 403 });
    }
    if (error instanceof ForbiddenError) {
        return server_1.NextResponse.json({ error: error.message, code: 'FORBIDDEN' }, { status: 403 });
    }
    // Generic error
    debug_logger_1.logger.error('Unhandled error in API route', {}, error);
    return server_1.NextResponse.json({ error: 'Internal server error', code: 'INTERNAL_ERROR' }, { status: 500 });
}
/**
 * Wrap an API handler with automatic error handling
 * @param handler - The API route handler
 * @returns Wrapped handler with error handling
 *
 * Usage:
 * ```typescript
 * export const POST = withErrorHandling(async (request: Request) => {
 *   const user = await requireAuthentication();
 *   // ... rest of handler
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
function withErrorHandling(handler) {
    return async (request, context) => {
        try {
            return await handler(request, context);
        }
        catch (error) {
            return handleGuardError(error);
        }
    };
}
/**
 * Comprehensive API route wrapper that eliminates boilerplate.
 *
 * Handles: Supabase client creation, authentication, permission checks,
 * and error responses. Your handler receives a pre-authenticated context.
 *
 * Usage:
 * ```typescript
 * // Simple authenticated route
 * export const GET = withApiRoute(async (request, { user, supabase }) => {
 *   const { data } = await supabase.from('projects').select('*');
 *   return NextResponse.json(data);
 * });
 *
 * // Route with permission check
 * export const POST = withApiRoute(
 *   async (request, { user, supabase }) => {
 *     const body = await request.json();
 *     const { data } = await supabase.from('projects').insert(body).select().single();
 *     return NextResponse.json(data, { status: 201 });
 *   },
 *   { permission: Permission.MANAGE_PROJECTS }
 * );
 *
 * // Route with contextual permission
 * export const PUT = withApiRoute(
 *   async (request, { user, supabase, params }) => {
 *     const body = await request.json();
 *     await supabase.from('projects').update(body).eq('id', params.projectId);
 *     return NextResponse.json({ success: true });
 *   },
 *   {
 *     permission: Permission.MANAGE_PROJECTS,
 *     getContext: (_req, params) => ({ projectId: params.projectId }),
 *   }
 * );
 * ```
 */
function withApiRoute(handler, options) {
    return async (request, routeContext) => {
        try {
            const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
            if (!supabase) {
                return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
            }
            const user = await requireAuthentication(request);
            // Next.js 15 makes params a Promise in some cases
            const params = routeContext?.params
                ? (typeof routeContext.params.then === 'function'
                    ? await routeContext.params
                    : routeContext.params)
                : {};
            if (options?.permission) {
                const permContext = options.getContext?.(request, params);
                await requirePermission(user, options.permission, permContext, supabase);
            }
            return await handler(request, { user, supabase, params });
        }
        catch (error) {
            return handleGuardError(error);
        }
    };
}
// ================================================================================
// COMBINED GUARDS (CONVENIENCE)
// ================================================================================
/**
 * All-in-one: Require authentication + permission
 * @param permission - Required permission
 * @param context - Optional context
 * @param request - Optional NextRequest for API routes
 * @returns UserWithRoles profile
 */
async function requireAuthAndPermission(permission, context, request) {
    const user = await requireAuthentication(request);
    // Create Supabase client from request for context-aware permission checks
    const supabaseClient = request ? (0, supabase_server_1.createApiSupabaseClient)(request) : null;
    await requirePermission(user, permission, context, supabaseClient);
    return user;
}
/**
 * All-in-one: Require authentication + any permission
 * @param permissions - Array of permissions (need at least one)
 * @param context - Optional context
 * @param request - Optional NextRequest for API routes
 * @returns UserWithRoles profile
 */
async function requireAuthAndAnyPermission(permissions, context, request) {
    const user = await requireAuthentication(request);
    // Create Supabase client from request for context-aware permission checks
    const supabaseClient = request ? (0, supabase_server_1.createApiSupabaseClient)(request) : null;
    await requireAnyPermission(user, permissions, context, supabaseClient);
    return user;
}
/**
 * All-in-one: Require authentication + superadmin
 * @returns UserWithRoles profile
 */
async function requireAuthAndSuperadmin() {
    const user = await requireAuthentication();
    await requireSuperadmin(user);
    return user;
}
