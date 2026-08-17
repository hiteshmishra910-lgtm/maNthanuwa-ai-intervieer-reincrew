import { supabase } from '../database/supabaseClient';

// Updated interface — added responseTimes and checkedAt
export interface SystemHealth {
    database: boolean;
    storage: boolean;
    auth: boolean;
    lastChecked: number;
    errors: string[];
    responseTimes: {
        database: number;
        storage: number;
        auth: number;
        total: number;
    };
    checkedAt: string;
}

export class HealthService {
    static async checkSystemHealth(): Promise<SystemHealth> {
        const health: SystemHealth = {
            database: false,
            storage: false,
            auth: !!supabase,
            lastChecked: Date.now(),
            errors: [],
            responseTimes: { database: 0, storage: 0, auth: 0, total: 0 },
            checkedAt: new Date().toISOString()
        };

        if (!supabase) {
            health.errors.push("Supabase client not initialized (missing env vars).");
            return health;
        }

        // ✓ timing starts INSIDE the method, before Promise.all
        const totalStart = performance.now();

        const [dbCheck, storageCheck, authCheck] = await Promise.all([
            // 1. Check Database
            (async () => {
                const start = performance.now();
                try {
                    const { error } = await supabase.from('job_posts').select('id').limit(1);
                    const duration = Math.round(performance.now() - start);
                    if (error) return { ok: false, error: `Database error: ${error.message}`, duration };
                    return { ok: true, duration };
                } catch (e: any) {
                    const duration = Math.round(performance.now() - start);
                    return { ok: false, error: `Database reachability failed: ${e.message}`, duration };
                }
            })(),

            // 2. Check Storage
            (async () => {
                const start = performance.now();
                try {
                    const { error } = await supabase.storage.listBuckets();
                    const duration = Math.round(performance.now() - start);
                    if (error && error.message.includes("FetchError")) {
                        return { ok: false, error: `Storage reachability failed: ${error.message}`, duration };
                    }
                    return { ok: true, duration };
                } catch (e: any) {
                    const duration = Math.round(performance.now() - start);
                    return { ok: false, error: `Storage reachability failed: ${e.message}`, duration };
                }
            })(),

            // 3. Check Auth
            (async () => {
                const start = performance.now();
                try {
                    const { error } = await supabase.auth.getSession();
                    const duration = Math.round(performance.now() - start);
                    if (error) return { ok: false, error: `Auth error: ${error.message}`, duration };
                    return { ok: true, duration };
                } catch (e: any) {
                    const duration = Math.round(performance.now() - start);
                    return { ok: false, error: `Auth reachability failed: ${e.message}`, duration };
                }
            })()
        ]);

        const totalDuration = Math.round(performance.now() - totalStart);

        if (dbCheck.ok) health.database = true;
        else health.errors.push(dbCheck.error!);

        if (storageCheck.ok) health.storage = true;
        else health.errors.push(storageCheck.error!);

        if (authCheck.ok) health.auth = true;
        else health.errors.push(authCheck.error!);

        // ✓ fills in the actual timing for each check
        health.responseTimes = {
            database: dbCheck.duration,
            storage: storageCheck.duration,
            auth: authCheck.duration,
            total: totalDuration
        };
        health.checkedAt = new Date().toISOString();

        return health;
    }
}
