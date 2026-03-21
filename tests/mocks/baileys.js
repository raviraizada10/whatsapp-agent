/**
 * Mock for @whiskeysockets/baileys
 * 
 * Usage in jest.config.js:
 * moduleNameMapper: {
 *   '^@whiskeysockets/baileys$': '<rootDir>/tests/mocks/baileys.js'
 * }
 */

const mockEventHandlers = {};

const mockSocket = {
    ev: {
        on: jest.fn((event, handler) => {
            mockEventHandlers[event] = handler;
        }),
        emit: jest.fn((event, data) => {
            if (mockEventHandlers[event]) {
                mockEventHandlers[event](data);
            }
        })
    },
    sendMessage: jest.fn().mockResolvedValue({ status: 1 }),
    user: { id: 'test-user-id' },
    logout: jest.fn().mockResolvedValue(),
    end: jest.fn().mockResolvedValue()
};

const makeWASocket = jest.fn().mockReturnValue(mockSocket);

const useMultiFileAuthState = jest.fn().mockResolvedValue({
    state: {
        creds: {},
        keys: {}
    },
    saveCreds: jest.fn()
});

const DisconnectReason = {
    loggedOut: 401,
    connectionClosed: 428,
    connectionDisconnected: 408,
    connectionReplaced: 440,
    restartRequired: 515,
    timedOut: 408,
    multideviceMismatch: 411
};

const fetchLatestBaileysVersion = jest.fn().mockResolvedValue({
    version: [2, 2409, 2],
    isLatest: true
});

const Browsers = {
    macOS: jest.fn().mockReturnValue(['macOS', 'Safari', '1.0.0']),
    ubuntu: jest.fn().mockReturnValue(['Ubuntu', 'Chrome', '1.0.0'])
};

module.exports = {
    default: makeWASocket,
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
    mockSocket,
    mockEventHandlers
};
