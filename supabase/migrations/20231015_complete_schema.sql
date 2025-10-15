-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    max_team_size INTEGER DEFAULT 4,
    is_active BOOLEAN DEFAULT true,
    registration_deadline TIMESTAMP WITH TIME ZONE,
    sheet_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Problem Statements table
CREATE TABLE IF NOT EXISTS public.problem_statements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sheet_tab_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Registrations table
CREATE TABLE IF NOT EXISTS public.registrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    reg_code TEXT UNIQUE NOT NULL,
    team_name TEXT NOT NULL,
    email TEXT NOT NULL,
    college_name TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    team_size INTEGER DEFAULT 1,
    team_members TEXT[],
    is_locked BOOLEAN DEFAULT false,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    problem_statement_id UUID NOT NULL REFERENCES problem_statements(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT valid_team_size CHECK (team_size > 0 AND team_size <= 4)
);

-- Attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    registration_id UUID NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL,
    is_present BOOLEAN DEFAULT false NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_member_attendance UNIQUE (registration_id, member_name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active);
CREATE INDEX IF NOT EXISTS idx_problem_statements_event ON problem_statements(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_event ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_problem ON registrations(problem_statement_id);
CREATE INDEX IF NOT EXISTS idx_attendance_registration ON attendance(registration_id);
CREATE INDEX IF NOT EXISTS idx_registrations_reg_code ON registrations(reg_code);

-- Enable Row Level Security (RLS)
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problem_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
CREATE POLICY "Allow public read access to events" ON public.events
    FOR SELECT USING (true);

-- RLS Policies for problem statements
CREATE POLICY "Allow public read access to problem statements" ON public.problem_statements
    FOR SELECT USING (true);

-- RLS Policies for registrations
CREATE POLICY "Allow public read access to registrations" ON public.registrations
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert to registrations" ON public.registrations
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to own registration" ON public.registrations
    FOR UPDATE USING (true);

-- RLS Policies for attendance
CREATE POLICY "Allow public read access to attendance" ON public.attendance
    FOR SELECT USING (true);

CREATE POLICY "Allow public create attendance records" ON public.attendance
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update attendance records" ON public.attendance
    FOR UPDATE USING (true);

-- Function to get team attendance URL
CREATE OR REPLACE FUNCTION get_team_attendance_url(reg_code text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT '/attendance/' || reg_code;
$$;

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at columns
CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_problem_statements_updated_at
    BEFORE UPDATE ON problem_statements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registrations_updated_at
    BEFORE UPDATE ON registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE public.events IS 'Stores information about tech events';
COMMENT ON TABLE public.problem_statements IS 'Problem statements associated with events';
COMMENT ON TABLE public.registrations IS 'Team registrations for events';
COMMENT ON TABLE public.attendance IS 'Attendance tracking for team members';

COMMENT ON COLUMN public.events.sheet_id IS 'Google Sheets ID for event data sync';
COMMENT ON COLUMN public.problem_statements.sheet_tab_name IS 'Tab name in Google Sheets for problem statement';
COMMENT ON COLUMN public.registrations.reg_code IS 'Unique registration code for team';
COMMENT ON COLUMN public.registrations.team_members IS 'Array of team member names';
COMMENT ON COLUMN public.attendance.is_present IS 'Whether the team member is present';