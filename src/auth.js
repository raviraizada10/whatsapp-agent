const { BufferJSON, initAuthCreds, proto } = require('@whiskeysockets/baileys');

/**
 * Custom Baileys authentication provider that stores session data in Supabase.
 * This ensures that the WhatsApp login persists across Render restarts/sleeps.
 */
async function useSupabaseAuthState(supabase) {
    const writeData = async (data, id) => {
        try {
            const dataString = JSON.stringify(data, BufferJSON.replacer);
            const { error } = await supabase
                .from('auth_session')
                .upsert({ 
                    id, 
                    data: JSON.parse(dataString),
                    updated_at: new Date().toISOString()
                });
            if (error) console.error(`Supabase Auth Save Error (${id}):`, error.message);
        } catch (err) {
            console.error(`Supabase Auth Save Critical (${id}):`, err.message);
        }
    };

    const readData = async (id) => {
        try {
            const { data, error } = await supabase
                .from('auth_session')
                .select('data')
                .eq('id', id)
                .single();

            if (error || !data) return null;
            const dataString = JSON.stringify(data.data);
            return JSON.parse(dataString, BufferJSON.reviver);
        } catch (err) {
            console.error(`Supabase Auth Read Critical (${id}):`, err.message);
            return null;
        }
    };

    const removeData = async (id) => {
        try {
            await supabase.from('auth_session').delete().eq('id', id);
        } catch (err) {
            console.error(`Supabase Auth Delete Error (${id}):`, err.message);
        }
    };

    // Initialize credentials
    let creds = await readData('creds');
    if (!creds) {
        creds = initAuthCreds();
        await writeData(creds, 'creds');
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData(creds, 'creds');
        },
        clearAuth: async () => {
            console.log('🧹 Clearing all Auth Session data from Supabase...');
            await supabase.from('auth_session').delete().neq('id', 'dummy_id'); // Delete all
        }
    };
}

module.exports = { useSupabaseAuthState };
