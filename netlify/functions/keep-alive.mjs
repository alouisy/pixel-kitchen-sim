import { supabaseRequest } from './_supabase.mjs';

export default async function handler(request, context) {
    console.log('Running keep-alive ping for Supabase...');
    try {
        const result = await supabaseRequest('leaderboard_entries?limit=1');
        console.log('Supabase ping successful:', result);
        return new Response(JSON.stringify({ success: true, message: 'Ping successful', data: result }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Supabase ping failed:', error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

export const config = {
    schedule: "@daily"
};
