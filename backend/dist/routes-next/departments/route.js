"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
async function GET(request) {
    try {
        // Check authentication and permission
        await (0, server_guards_1.requireAuthAndAnyPermission)([
            permissions_1.Permission.VIEW_DEPARTMENTS,
            permissions_1.Permission.VIEW_ALL_DEPARTMENTS
        ], undefined, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        // Fetch all departments
        const { data: departments, error } = await supabase
            .from('departments')
            .select('id, name, description, created_at, updated_at')
            .order('name');
        if (error) {
            debug_logger_1.logger.error('Error fetching departments', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
        }
        return server_1.NextResponse.json(departments || []);
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
async function POST(request) {
    try {
        // Check authentication and permission (consolidated from CREATE_DEPARTMENT)
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_DEPARTMENTS, {}, request);
        const supabase = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { name, description } = body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return server_1.NextResponse.json({ error: 'Department name is required' }, { status: 400 });
        }
        if (name.trim().length > 100) {
            return server_1.NextResponse.json({ error: 'Department name must be 100 characters or less' }, { status: 400 });
        }
        if (description !== undefined && description !== null) {
            if (typeof description !== 'string') {
                return server_1.NextResponse.json({ error: 'Description must be a string' }, { status: 400 });
            }
            if (description.length > 500) {
                return server_1.NextResponse.json({ error: 'Description must be 500 characters or less' }, { status: 400 });
            }
        }
        const { data, error } = await supabase
            .from('departments')
            .insert({
            name: name.trim(),
            description: description?.trim() || null,
        })
            .select()
            .single();
        if (error) {
            if (error.code === '23505') {
                return server_1.NextResponse.json({ error: 'A department with this name already exists' }, { status: 409 });
            }
            debug_logger_1.logger.error('Error creating department', {}, error);
            console.error('[departments POST] Supabase insert error:', JSON.stringify(error));
            return server_1.NextResponse.json({ error: error.message || 'Failed to create department' }, { status: 500 });
        }
        return server_1.NextResponse.json(data);
    }
    catch (error) {
        console.error('[departments POST] Caught error:', error);
        return (0, server_guards_1.handleGuardError)(error);
    }
}
