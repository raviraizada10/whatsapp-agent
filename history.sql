-- Create the message history table
CREATE TABLE IF NOT EXISTS public.history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (optional but recommended)
ALTER TABLE public.history ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (adjust as needed for your specific security model)
CREATE POLICY "Enable all for authenticated users" ON public.history FOR ALL USING (true);
