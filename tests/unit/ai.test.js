const { generateMessage } = require('../../src/ai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const registry = require('../../src/tools');

jest.mock('@google/generative-ai');
jest.mock('../../src/tools');

describe('AI Module - generateMessage (ReAct Loop)', () => {
    let mockGenerateContent;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGenerateContent = jest.fn();

        GoogleGenerativeAI.mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
                generateContent: mockGenerateContent
            })
        }));
    });

    it('should generate a direct message if no tool is needed', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => 'THOUGHT: I should say hi.\nFINAL RESPONSE: Hello John!'
            }
        });

        const result = await generateMessage('John', 'Say hi');
        
        expect(result).toBe('Hello John!');
        expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should execute a tool and then provide a final response', async () => {
        // First call: Request Tool
        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => 'THOUGHT: I need to check the weather.\nACTION: web_search({"query": "weather in London"})'
            }
        });

        // Mock Tool Execution
        registry.call.mockResolvedValueOnce('Cloudy with a chance of rain.');

        // Second call: Provide Final Response after observation
        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => 'THOUGHT: It is cloudy.\nFINAL RESPONSE: It is cloudy in London today.'
            }
        });

        const result = await generateMessage('Friend', 'weather in London');
        
        expect(result).toBe('It is cloudy in London today.');
        expect(registry.call).toHaveBeenCalledWith('web_search', { query: 'weather in London' });
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should handle tool execution errors gracefully', async () => {
        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => 'THOUGHT: Tracking train.\nACTION: track_train({"trainNo": "12345"})'
            }
        });

        registry.call.mockResolvedValueOnce('Error: API offline');

        mockGenerateContent.mockResolvedValueOnce({
            response: {
                text: () => 'THOUGHT: Search failed.\nFINAL RESPONSE: Sorry, I couldn\'t track your train right now.'
            }
        });

        const result = await generateMessage('Dad', 'track train 12345');
        
        expect(result).toBe("Sorry, I couldn't track your train right now.");
        expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should return null if generateContent throws an error', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));
        
        const result = await generateMessage('John', 'Say hi');
        expect(result).toBeNull();
    });
});
