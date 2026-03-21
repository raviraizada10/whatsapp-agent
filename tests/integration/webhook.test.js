const request = require('supertest');
const { startWebhookServer, setWebhookGlobals } = require('../../src/webhook');

jest.mock('../../src/db', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis()
    }
}));

describe('Webhook Server', () => {
    let app;
    let mockJob;

    beforeAll(() => {
        // Prevent setInterval from keeping tests open
        jest.useFakeTimers();
        
        process.env.WEBHOOK_SECRET = 'test-secret';
        app = startWebhookServer();
        
        mockJob = {
            invokeJob: jest.fn().mockResolvedValue(),
            recipient_name: 'Test User'
        };
        
        setWebhookGlobals({ '1234': mockJob }, {});
    });

    afterAll((done) => {
        jest.useRealTimers();
        if (app && app.server) {
            app.server.close(done);
        } else {
            done();
        }
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GET /health', () => {
        it('should return health status', async () => {
            const res = await request(app).get('/health');
            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual({ status: 'ok', activeJobs: 1 });
        });
    });

    describe('POST /webhook/trigger', () => {
        it('should block unauthorized requests', async () => {
            const res = await request(app)
                .post('/webhook/trigger')
                .send({ schedule_id: '1234' });
                
            expect(res.statusCode).toBe(401);
            expect(res.body).toHaveProperty('error', 'Unauthorized');
        });

        it('should trigger a job successfully', async () => {
            const res = await request(app)
                .post('/webhook/trigger')
                .set('Authorization', 'Bearer test-secret')
                .send({ schedule_id: '1234' });
                
            expect(res.statusCode).toBe(200);
            expect(mockJob.invokeJob).toHaveBeenCalled();
            expect(res.body).toHaveProperty('success', true);
        });

        it('should return 404 for unknown schedule', async () => {
            const res = await request(app)
                .post('/webhook/trigger')
                .set('Authorization', 'Bearer test-secret')
                .send({ schedule_id: '9999' });
                
            expect(res.statusCode).toBe(404);
            expect(res.body.error).toContain('No active job found');
        });
    });
});
