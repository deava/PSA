"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * GET /api/accounts/members
 * Get all accounts with their assigned members
 */
async function GET(request) {
    try {
        // Require VIEW_ALL_ACCOUNTS permission
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.VIEW_ALL_ACCOUNTS, {}, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
        }
        // Get all accounts with account manager details
        const { data: accounts, error: accountsError } = await supabase
            .from('accounts')
            .select(`
        id,
        name,
        description,
        status,
        account_manager_id,
        account_manager:user_profiles(
          id,
          name,
          email,
          image
        )
      `)
            .order('name');
        if (accountsError) {
            debug_logger_1.logger.error('Error fetching accounts', {}, accountsError);
            return server_1.NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
        }
        // Get all account members with user details
        const { data: allMembers, error: membersError } = await supabase
            .from('account_members')
            .select(`
        id,
        user_id,
        account_id,
        created_at,
        user_profiles(
          id,
          name,
          email,
          image,
          user_roles!user_id(
            id,
            roles!role_id(
              id,
              name,
              department_id,
              departments(
                id,
                name
              )
            )
          )
        )
      `)
            .order('created_at', { ascending: false });
        // Group members by account
        const accountsWithMembers = (accounts || []).map((account) => {
            // Handle case where account_members table doesn't exist
            if (membersError) {
                debug_logger_1.logger.error('Error fetching account members', {}, membersError);
                // If table doesn't exist, return empty members array
                if (membersError.code === 'PGRST116' || membersError.code === '42P01' || membersError.message?.includes('does not exist')) {
                    debug_logger_1.logger.debug('account_members table does not exist, returning empty members', {});
                    return {
                        ...account,
                        members: [],
                        member_count: 0
                    };
                }
            }
            const members = (allMembers || []).filter((m) => m.account_id === account.id);
            const formattedMembers = members.map((member) => {
                const userProfile = member.user_profiles;
                const userRoles = userProfile?.user_roles || [];
                return {
                    id: member.id,
                    user_id: member.user_id,
                    account_id: member.account_id,
                    created_at: member.created_at,
                    user: userProfile ? {
                        id: userProfile.id,
                        name: userProfile.name,
                        email: userProfile.email,
                        image: userProfile.image,
                        roles: userRoles.map((ur) => {
                            const role = ur.roles;
                            const department = role?.departments;
                            return {
                                id: role?.id,
                                name: role?.name,
                                department: department ? {
                                    id: department.id,
                                    name: department.name
                                } : null
                            };
                        }).filter((r) => r.id) // Filter out any invalid roles
                    } : null
                };
            });
            return {
                ...account,
                members: formattedMembers,
                member_count: formattedMembers.length
            };
        });
        return server_1.NextResponse.json({ accounts: accountsWithMembers });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/accounts/members', {}, error);
        return (0, server_guards_1.handleGuardError)(error);
    }
}
