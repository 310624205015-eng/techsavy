import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Building2, Users, Loader2 } from 'lucide-react';

interface Registration {
  id: string;
  reg_code: string;
  team_name: string;
  email: string;
  college_name: string;
  contact_number: string;
  team_members: string[];
  event_id: string;
  problem_statement_id: string;
  events: Array<{
    id: string;
    name: string;
    description: string;
  }>;
  problem_statements: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  attendance_update_count?: number;
}

interface MemberAttendance {
  [key: string]: boolean;
}

export default function AttendancePage() {
  const { regCode } = useParams<{ regCode: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [attendance, setAttendance] = useState<MemberAttendance>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        // Get registration details
        // Get registration with event and problem statement details
        const { data: reg, error: regError } = await supabase
          .from('registrations')
          .select(`
            id,
            reg_code,
            team_name,
            email,
            college_name,
            contact_number,
            team_members,
            problem_statement_id,
            event_id,
            events!inner (
              id,
              name,
              description
            ),
            problem_statements!inner (
              id,
              title,
              description
            )
          `)
          .eq('reg_code', regCode)
          .single();

        if (regError) throw regError;
        if (!reg) throw new Error('Registration not found');

        const formattedReg: Registration = {
          id: reg.id,
          reg_code: reg.reg_code,
          team_name: reg.team_name,
          email: reg.email,
          college_name: reg.college_name,
          contact_number: reg.contact_number,
          team_members: reg.team_members || [],
          events: reg.events || [],
          problem_statements: reg.problem_statements || [],
          event_id: reg.event_id,
          problem_statement_id: reg.problem_statement_id
          ,
          attendance_update_count: (reg as any).attendance_update_count || 0
        };

        setRegistration(formattedReg);

        // Get attendance for each team member
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select('*')
          .eq('registration_id', reg.id);

        if (attendanceError) throw attendanceError;

        // Create attendance state object
        const attendanceState: MemberAttendance = {};
        formattedReg.team_members.forEach(member => {
          const memberAttendance = attendanceData?.find(a => a.member_name === member);
          attendanceState[member] = memberAttendance?.is_present || false;
        });

        setAttendance(attendanceState);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    if (regCode) {
      fetchData();
    }
  }, [regCode]);

  const toggleAttendance = async (memberName: string) => {
    if (!registration || saving) return;

    setSaving(true);
    try {
      const newState = !attendance[memberName];
      const prevState = attendance[memberName];

      // Enforce a max of 2 attendance updates per registration
      const currentCount = registration.attendance_update_count || 0;
      if (currentCount >= 2) {
        setError('Attendance update limit reached for this team.');
        setSaving(false);
        return;
      }
      
      // Upsert attendance record
      const { error } = await supabase
        .from('attendance')
        .upsert({
          registration_id: registration.id,
          member_name: memberName,
          is_present: newState,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'registration_id,member_name'
        });

      if (error) throw error;

      setAttendance(prev => ({
        ...prev,
        [memberName]: newState
      }));

      // Try to increment the registration's attendance_update_count atomically (only if current matches)
      const expected = registration.attendance_update_count || 0;
      const { data: updData, error: updErr } = await supabase
        .from('registrations')
        .update({ attendance_update_count: expected + 1 })
        .eq('id', registration.id)
        .eq('attendance_update_count', expected)
        .select('attendance_update_count')
        .maybeSingle();

      if (updErr) {
        throw updErr;
      }

      if (!updData) {
        // Another updater likely raced and changed the count / limit reached. Revert attendance change and show error.
        await supabase.from('attendance').upsert({
          registration_id: registration.id,
          member_name: memberName,
          is_present: prevState,
          last_updated: new Date().toISOString()
        }, { onConflict: 'registration_id,member_name' });

        setAttendance(prev => ({ ...prev, [memberName]: prevState }));
        // Refresh registration count
        const { data: freshReg } = await supabase.from('registrations').select('attendance_update_count').eq('id', registration.id).maybeSingle();
        if (freshReg) setRegistration({ ...registration, attendance_update_count: freshReg.attendance_update_count || 0 });
        setError('Attendance update failed due to concurrent updates or limit reached.');
        return;
      }

      // Update local registration count
      setRegistration({ ...registration, attendance_update_count: updData.attendance_update_count || expected + 1 });
    } catch (err) {
      console.error('Error updating attendance:', err);
      setError('Failed to update attendance');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-gray-900 p-4 rounded-lg flex items-center gap-2 text-red-500 border border-red-500/20">
        <Loader2 className="animate-spin" />
        <span>Loading team details...</span>
      </div>
    </div>
  );
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!registration) return <div className="p-4">Registration not found</div>;

  return (
    <main className="min-h-screen bg-black text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Team Info Card */}
        <div className="bg-gray-900 rounded-lg shadow-red-500/10 shadow-lg p-6 mb-8 border border-red-500/20">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-red-500">{registration.team_name}</h1>
            <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-sm border border-red-500/20">
              {registration.reg_code}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-gray-400">
              <Building2 size={20} />
              <span>{registration.college_name}</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-400">
              <Users size={20} />
              <span>{(registration.team_members || []).length} members</span>
            </div>
          </div>

          <div className="border-t border-red-500/20 pt-4">
            <h3 className="font-semibold mb-2 text-red-400">Event Details</h3>
            <p className="text-gray-400">
              {registration.events[0]?.name || 'Not specified'} - {registration.problem_statements[0]?.title || 'Not specified'}
            </p>
          </div>

          {/* Team Members Attendance */}
          <div className="border-t border-red-500/20 mt-6 pt-6">
            <h3 className="font-semibold mb-4 text-red-400">Mark Attendance</h3>
            <div className="grid gap-4">
              {registration.team_members.map((member) => (
                <div
                  key={member}
                  className={`p-4 rounded-lg flex items-center justify-between ${
                    saving ? 'opacity-50' : ''
                  } bg-gray-800/50 backdrop-blur-sm`}
                >
                  <span className="font-medium text-gray-200">{member}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={attendance[member]}
                      onChange={() => toggleAttendance(member)}
                      disabled={saving}
                    />
                    <div className="w-14 h-7 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}