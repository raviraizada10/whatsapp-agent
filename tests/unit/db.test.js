const { getActiveSchedules, getNotificationSetting, getContactPersona } = require('../../src/db');
const { createClient } = require('@supabase/supabase-js');

jest.mock('@supabase/supabase-js', () => {
    const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn()
    };
    return {
        createClient: jest.fn(() => mockSupabase)
    };
});

// Create a copy of the mocked client to manipulate its behavior in tests
const expectedSupabaseMock = createClient();

describe('DB Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Since db.js module level initialization happens immediately when required, we must manipulate require.cache or manipulate the mock instance.
        // The mock instance expectedSupabaseMock is the same one returned inside db.js since jest.mock creates a singleton block.
    });

    describe('getActiveSchedules', () => {
        it('should return schedules if found', async () => {
            expectedSupabaseMock.eq.mockResolvedValueOnce({ data: [{ id: 1, is_active: true, contacts: { name: 'Alice', phone: '123' } }], error: null });
            
            const schedules = await getActiveSchedules();
            expect(schedules).toHaveLength(1);
            expect(schedules[0].id).toBe(1);
            expect(schedules[0].recipient_name).toBe('Alice');
            expect(schedules[0].contact_number).toBe('123');
            expect(expectedSupabaseMock.from).toHaveBeenCalledWith('schedules');
        });

        it('should return empty array on database error', async () => {
            expectedSupabaseMock.eq.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });
            
            const schedules = await getActiveSchedules();
            expect(schedules).toEqual([]);
        });
    });

    describe('getNotificationSetting', () => {
        it('should return setting value if found', async () => {
            expectedSupabaseMock.single.mockResolvedValueOnce({ data: { admin_notifications: false }, error: null });
            
            const setting = await getNotificationSetting();
            expect(setting).toBe(false);
            expect(expectedSupabaseMock.from).toHaveBeenCalledWith('settings');
        });

        it('should return true (default) on error', async () => {
            expectedSupabaseMock.single.mockResolvedValueOnce({ data: null, error: new Error('Not found') });
            
            const setting = await getNotificationSetting();
            expect(setting).toBe(true);
        });
    });

    describe('getContactPersona', () => {
        it('should return persona context if found', async () => {
            expectedSupabaseMock.single.mockResolvedValueOnce({ data: { persona_context: 'Test context' } });
            
            const persona = await getContactPersona('1234567890');
            expect(persona).toBe('Test context');
            expect(expectedSupabaseMock.from).toHaveBeenCalledWith('contacts');
            expect(expectedSupabaseMock.eq).toHaveBeenCalledWith('phone', '1234567890');
        });

        it('should return null on error or no data', async () => {
            expectedSupabaseMock.single.mockRejectedValueOnce(new Error('Network error'));
            
            const persona = await getContactPersona('1234567890');
            expect(persona).toBeNull();
        });
    });
});
