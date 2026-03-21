const { generateMessage } = require('../../src/ai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const irctcConnect = require('irctc-connect');

jest.mock('@google/generative-ai');
jest.mock('axios');
jest.mock('irctc-connect');

describe('AI Module - generateMessage', () => {
    let mockGenerateContent;

    beforeEach(() => {
        jest.clearAllMocks();

        mockGenerateContent = jest.fn().mockResolvedValue({
            response: {
                text: () => 'Mocked response'
            }
        });

        GoogleGenerativeAI.mockImplementation(() => ({
            getGenerativeModel: jest.fn().mockReturnValue({
                generateContent: mockGenerateContent
            })
        }));
    });

    it('should generate a message for a generic constraint', async () => {
        const result = await generateMessage('John', 'Say hi');
        
        expect(result).toBe('Mocked response');
        expect(GoogleGenerativeAI).toHaveBeenCalled();
        expect(mockGenerateContent).toHaveBeenCalled();
        const callArg = mockGenerateContent.mock.calls[0][0];
        expect(callArg).toContain('Say hi');
        expect(callArg).toContain('John');
    });

    it('should include persona context if provided', async () => {
        const result = await generateMessage('Mom', 'Ask about dinner', 'She likes Italian food');
        
        expect(result).toBe('Mocked response');
        const callArg = mockGenerateContent.mock.calls[0][0];
        expect(callArg).toContain('She likes Italian food');
    });

    it('should hit the live web search fallback on matching keywords', async () => {
        axios.post.mockResolvedValue({ data: '<div class="result-snippet">Search snippet data</div>' });

        const result = await generateMessage('Friend', 'weather in tokyo');
        
        expect(result).toBe('Mocked response');
        expect(axios.post).toHaveBeenCalled();
        const callArg = mockGenerateContent.mock.calls[0][0];
        expect(callArg).toContain('Search snippet data');
    });

    it('should fetch train data when tracking a train', async () => {
        irctcConnect.trackTrain.mockResolvedValue({
            success: true,
            data: {
                trainName: 'Express',
                trainNo: '12345',
                date: '20-03-2024',
                statusNote: 'On time',
                lastUpdate: 'Now',
                stations: []
            }
        });

        const result = await generateMessage('Dad', 'track train 12345');
        
        expect(result).toBe('Mocked response');
        expect(irctcConnect.trackTrain).toHaveBeenCalled();
        const callArg = mockGenerateContent.mock.calls[0][0];
        expect(callArg).toContain('12345');
        expect(callArg).toContain('Express');
        expect(callArg).toContain('On time');
    });

    it('should return null if generateContent throws an error', async () => {
        mockGenerateContent.mockRejectedValue(new Error('API Error'));
        
        const result = await generateMessage('John', 'Say hi');
        expect(result).toBeNull();
    });
});
