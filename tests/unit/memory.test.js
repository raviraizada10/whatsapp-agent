const { saveMessage, getConversationContext, generateContextualReply } = require('../../src/memory');
const { supabase } = require('../../src/db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

jest.mock('../../src/db', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis()
    }
}));

jest.mock('@google/generative-ai', () => ({
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
        getGenerativeModel: jest.fn().mockReturnValue({
            generateContent: jest.fn().mockResolvedValue({
                response: {
                    text: () => 'Mocked reply'
                }
            })
        })
    }))
}));

describe('Memory Module', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('saveMessage', () => {
        it('should save a message successfully', async () => {
            supabase.insert.mockResolvedValueOnce({ error: null });
            
            await saveMessage('12345', 'user', 'Hello Agent');
            
            expect(supabase.from).toHaveBeenCalledWith('chat_history');
            expect(supabase.insert).toHaveBeenCalledWith([{
                contact_phone: '12345',
                role: 'user',
                content: 'Hello Agent'
            }]);
        });
    });

    describe('getConversationContext', () => {
        it('should format message history correctly', async () => {
            supabase.limit.mockResolvedValueOnce({
                data: [
                    { role: 'user', content: 'Hi' },
                    { role: 'agent', content: 'Hello' }
                ]
            });

            const context = await getConversationContext('12345');
            
            expect(supabase.from).toHaveBeenCalledWith('chat_history');
            expect(context).toContain('You (Agent): Hello'); // reversed order
            expect(context).toContain('Contact: Hi');
        });

        it('should return empty string if no history', async () => {
            supabase.limit.mockResolvedValueOnce({ data: [] });
            
            const context = await getConversationContext('12345');
            
            expect(context).toBe('');
        });
    });

    describe('generateContextualReply', () => {
        it('should generate a reply with or without context', async () => {
            // Mock empty history first
            supabase.limit.mockResolvedValueOnce({ data: [] });
            
            const reply = await generateContextualReply('12345', 'John', 'How are you?');
            
            expect(reply).toBe('Mocked reply');
            expect(GoogleGenerativeAI).toHaveBeenCalled();
        });
    });
});
