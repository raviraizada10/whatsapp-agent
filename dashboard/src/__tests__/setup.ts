import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Provide a mock for matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Centralized mock data shared across tests
// We use a global variable to keep the mock objects consistent
if (!(global as any).NEXT_MOCKS) {
  (global as any).NEXT_MOCKS = {
    cookieStore: {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    },
    nextResponse: {
      json: vi.fn().mockImplementation((data, init) => ({
        status: init?.status || 200,
        headers: new Map(Object.entries(init?.headers || {})),
        json: async () => data,
      })),
      redirect: vi.fn().mockImplementation((url) => ({
        status: 307,
        headers: new Map([['Location', url.toString()]]),
        url: url.toString(),
      })),
      next: vi.fn().mockImplementation(() => ({
        status: 200,
        headers: new Map(),
      })),
    }
  };
}

export const { cookieStore, nextResponse } = (global as any).NEXT_MOCKS;
