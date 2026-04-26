"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newsletterService = void 0;
const supabase_1 = require("@/lib/supabase");
const debug_logger_1 = require("@/lib/debug-logger");
exports.newsletterService = {
    /**
     * Get all published newsletters (for display on welcome page)
     */
    async getPublishedNewsletters() {
        const supabase = (0, supabase_1.createClientSupabase)();
        // Optimized: Limit to 20 most recent newsletters
        const { data, error } = await supabase
            .from('newsletters')
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .eq('is_published', true)
            .order('published_at', { ascending: false })
            .limit(20);
        if (error) {
            debug_logger_1.logger.error('Error fetching newsletters', {}, error);
            throw error;
        }
        return data || [];
    },
    /**
     * Get all newsletters for a user (for management)
     */
    async getUserNewsletters() {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to view newsletters');
        }
        const { data, error } = await supabase
            .from('newsletters')
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .eq('created_by', session.user.id)
            .order('created_at', { ascending: false });
        if (error) {
            debug_logger_1.logger.error('Error fetching user newsletters', {}, error);
            throw error;
        }
        return data || [];
    },
    /**
     * Create a new newsletter
     */
    async createNewsletter(input) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to create a newsletter');
        }
        // First, test if the table exists by trying to select from it
        const { error: tableError } = await supabase
            .from('newsletters')
            .select('id')
            .limit(1);
        if (tableError) {
            debug_logger_1.logger.error('Newsletters table error', {}, tableError);
            throw new Error('Newsletters table not accessible. Please run the create-newsletters.sql script first.');
        }
        const { data, error } = await supabase
            .from('newsletters')
            .insert({
            title: input.title,
            content: input.content,
            created_by: session.user.id,
            is_published: true, // Auto-publish newsletters
            published_at: new Date().toISOString(),
        })
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error creating newsletter', {
                code: error.code,
            }, error);
            throw new Error('Failed to create newsletter');
        }
        return data;
    },
    /**
     * Update a newsletter
     */
    async updateNewsletter(newsletterId, input) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to update a newsletter');
        }
        const { data, error } = await supabase
            .from('newsletters')
            .update({
            ...input,
            updated_at: new Date().toISOString(),
        })
            .eq('id', newsletterId)
            .eq('created_by', session.user.id)
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating newsletter', {}, error);
            throw error;
        }
        return data;
    },
    /**
     * Publish a newsletter
     */
    async publishNewsletter(newsletterId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to publish a newsletter');
        }
        const { data, error } = await supabase
            .from('newsletters')
            .update({
            is_published: true,
            published_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
            .eq('id', newsletterId)
            .eq('created_by', session.user.id)
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error publishing newsletter', {}, error);
            throw error;
        }
        return data;
    },
    /**
     * Unpublish a newsletter
     */
    async unpublishNewsletter(newsletterId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to unpublish a newsletter');
        }
        const { data, error } = await supabase
            .from('newsletters')
            .update({
            is_published: false,
            published_at: null,
            updated_at: new Date().toISOString(),
        })
            .eq('id', newsletterId)
            .eq('created_by', session.user.id)
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error unpublishing newsletter', {}, error);
            throw error;
        }
        return data;
    },
    /**
     * Delete a newsletter
     */
    async deleteNewsletter(newsletterId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to delete a newsletter');
        }
        const { error } = await supabase
            .from('newsletters')
            .delete()
            .eq('id', newsletterId)
            .eq('created_by', session.user.id);
        if (error) {
            debug_logger_1.logger.error('Error deleting newsletter', {}, error);
            throw error;
        }
    }
};
