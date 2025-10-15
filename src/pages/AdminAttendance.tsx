import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';

type Event = {
  id: string;
  name: string;
};

interface TeamAttendanceView {
  registration: {
    id: string;
    team_name: string;
    reg_code: string;
    event_id: string;
    problem_statement_id: string;
    team_members: string[];
    problem_statement: {
      id: string;
      title: string;
    };
    event: {
      id: string;
      name: string;
    };
  };
  attendance: {
    [key: string]: {
      is_present: boolean;
      last_updated: string;
    };
  };
  stats: {
    total: number;
    present: number;
    percentage: number;
  };
}

export default function AdminAttendance() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [problemStatements, setProblemStatements] = useState<Array<{ id: string; title: string }>>([]);
  const [teamsAttendance, setTeamsAttendance] = useState<TeamAttendanceView[]>([]);
  const [overallStats, setOverallStats] = useState<{ total: number; present: number; percentage: number }>({ 
    total: 0, 
    present: 0, 
    percentage: 0 
  });
  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchProblemStatements();
      fetchAttendanceData();
    }
  }, [selectedEventId]);

  useEffect(() => {
    if (selectedEventId && selectedProblemId) {
      fetchAttendanceData();
    }
  }, [selectedProblemId]);

  const fetchEvents = async () => {
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('id, name')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setEvents(events || []);
      if (events && events.length > 0) {
        setSelectedEventId(events[0].id);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchProblemStatements = async () => {
    try {
      const { data: problems, error } = await supabase
        .from('problem_statements')
        .select('id, title')
        .eq('event_id', selectedEventId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;

      setProblemStatements(problems || []);
      if (problems && problems.length > 0) {
        setSelectedProblemId(problems[0].id);
      }
    } catch (error) {
      console.error('Error fetching problem statements:', error);
    }
  };

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      // Get registrations with their related event and problem statement data
      const query = supabase
        .from('registrations')
        .select(`
          id,
          team_name,
          reg_code,
          team_members,
          event_id,
          problem_statement_id,
          problem_statement:problem_statements(
            id,
            title
          ),
          event:events(
            id,
            name
          )
        `)
        .eq('event_id', selectedEventId);

      // Add problem statement filter if selected
      if (selectedProblemId) {
        query.eq('problem_statement_id', selectedProblemId);
      }

      const { data: registrations, error: regError } = await query;
      
      if (regError) throw regError;
      if (!registrations) return;

      // Get attendance records for all teams
      const { data: attendance, error: attError } = await supabase
        .from('attendance')
        .select('*')
        .in('registration_id', registrations.map(r => r.id))
        .order('last_updated', { ascending: false });

      if (attError) throw attError;

      // Process and combine the data
      let totalPresent = 0;
      let totalMembers = 0;

      const processedAttendance: TeamAttendanceView[] = registrations.map(reg => {
        const attendanceMap: { [key: string]: { is_present: boolean; last_updated: string } } = {};
        const memberAttendance = attendance?.filter(a => a.registration_id === reg.id) || [];
        
        let teamPresent = 0;
        const teamMembers = reg.team_members || [];
        teamMembers.forEach((member: string) => {
          const record = memberAttendance.find(a => a.member_name === member);
          attendanceMap[member] = {
            is_present: record?.is_present || false,
            last_updated: record?.last_updated || new Date().toISOString()
          };
          
          totalMembers++;
          if (record?.is_present) {
            totalPresent++;
            teamPresent++;
          }
        });

        return {
          registration: {
            id: reg.id,
            team_name: reg.team_name,
            reg_code: reg.reg_code,
            event_id: reg.event_id,
            problem_statement_id: reg.problem_statement_id,
            team_members: teamMembers,
            problem_statement: reg.problem_statement?.[0] || { id: '', title: 'Not specified' },
            event: reg.event?.[0] || { id: '', name: 'Not specified' }
          },
          attendance: attendanceMap,
          stats: {
            total: teamMembers.length,
            present: teamPresent,
            percentage: teamMembers.length > 0 ? (teamPresent / teamMembers.length) * 100 : 0
          }
        };
      });

      setTeamsAttendance(processedAttendance);
      setOverallStats({
        total: totalMembers,
        present: totalPresent,
        percentage: totalMembers > 0 ? (totalPresent / totalMembers) * 100 : 0
      });
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-gradient-to-r from-red-900 to-black border-b-2 border-red-600 py-6">
        <div className="container mx-auto px-4">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center text-gray-300 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold">Attendance Management</h1>
          
          <div className="mt-6 flex gap-4">
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-gray-900 text-white border border-red-600 rounded px-4 py-2"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>

            <select
              value={selectedProblemId}
              onChange={(e) => setSelectedProblemId(e.target.value)}
              className="bg-gray-900 text-white border border-red-600 rounded px-4 py-2"
            >
              {problemStatements.map((ps) => (
                <option key={ps.id} value={ps.id}>
                  {ps.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-red-600" />
          </div>
        ) : (
          <>
            <div className="bg-gray-900 border-2 border-red-800 rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-bold mb-4">Overall Statistics</h2>
              <div className="grid grid-cols-3 gap-6">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-gray-400">Total Members</p>
                  <p className="text-3xl font-bold">{overallStats.total}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-gray-400">Present</p>
                  <p className="text-3xl font-bold text-green-500">{overallStats.present}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <p className="text-gray-400">Attendance Rate</p>
                  <p className="text-3xl font-bold text-blue-500">
                    {overallStats.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-6">
              {teamsAttendance.map((team) => (
                <div
                  key={team.registration.id}
                  className="bg-gray-900 border-2 border-red-800 rounded-lg p-6"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold">{team.registration.team_name}</h3>
                      <p className="text-gray-400 text-sm mt-1">
                        Problem: {team.registration.problem_statement?.title || 'Not specified'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Attendance Rate</p>
                      <p className="text-2xl font-bold text-blue-500">
                        {team.stats.percentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {team.registration.team_members.map((member) => (
                      <div
                        key={member}
                        className="flex items-center justify-between bg-gray-800 p-3 rounded"
                      >
                        <div className="flex items-center">
                          <span className="text-gray-300">{member}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-gray-400">
                            Last update: {new Date(team.attendance[member].last_updated).toLocaleString()}
                          </span>
                          {team.attendance[member].is_present ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}