import { expect, test, vi } from 'vitest'
import { supabase } from '../lib/supabase'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { getSession: vi.fn() },
    from: vi.fn()
  }))
}))

test('supabase client is initialized', () => {
  expect(supabase).toBeDefined()
})
