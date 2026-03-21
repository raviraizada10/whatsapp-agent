-- ==========================================
-- WhatsApp AgentFlow - Complete Supabase Schema
-- Instructions: Copy this entire file and run it once in your Supabase SQL Editor
-- ==========================================

-- 1. Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  persona_context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Schedules (The Core Agent Cron Tasks)
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  time_cron TEXT NOT NULL,
  constraint_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Global Agent Settings 
CREATE TABLE IF NOT EXISTS settings (
  id integer primary key default 1,
  admin_notifications boolean default true,
  qr_code TEXT,
  connection_status TEXT DEFAULT 'disconnected',
  last_heartbeat TIMESTAMP WITH TIME ZONE
);

-- Initialize the settings singleton row
INSERT INTO settings (id, admin_notifications) VALUES (1, true) ON CONFLICT (id) DO NOTHING;


-- ==========================================
-- ADVANCED AGENTIC FEATURES (PHASE 5)
-- ==========================================

-- 4. Delivery Queue (For pre-approval draft workflows)
CREATE TABLE IF NOT EXISTS delivery_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, approved, sent, discarded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Chat History (For two-way context conversational memory)
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- 'user' or 'agent'
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Manual Triggers (For Dashboard 'Send Now' overrides)
CREATE TABLE IF NOT EXISTS manual_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. WhatsApp Auth Session (For persistent login across restarts)
CREATE TABLE IF NOT EXISTS auth_session (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
