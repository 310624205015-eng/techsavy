import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';
import { supabase, Event, ProblemStatement, Registration } from '../lib/supabase';
import { ArrowLeft, Lock, Unlock, Download } from 'lucide-react';

export default function AdminRegistrations() {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([]);
  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin');
    } else {
      fetchEvents();
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (selectedEvent) {
      fetchProblemStatements(selectedEvent);
      setSelectedProblem(null);
      setRegistrations([]);
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (selectedProblem) {
      fetchRegistrations(selectedProblem);
    }
  }, [selectedProblem]);

  async function fetchEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEvents(data);
    }
  }

  async function fetchProblemStatements(eventId: string) {
    const { data, error } = await supabase
      .from('problem_statements')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProblemStatements(data);
    }
  }

  async function fetchRegistrations(problemId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('registrations')
      .select('*')
      .eq('problem_statement_id', problemId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRegistrations(data);
    }
    setLoading(false);
  }

  async function toggleLock(registration: Registration) {
    const { error } = await supabase
      .from('registrations')
      .update({ is_locked: !registration.is_locked })
      .eq('id', registration.id);

    if (!error) {
      setRegistrations(registrations.map(r =>
        r.id === registration.id ? { ...r, is_locked: !r.is_locked } : r
      ));
    }
  }

  async function exportToSheets() {
    if (!selectedEvent || !selectedProblem) return;

    const event = events.find(e => e.id === selectedEvent);
    const problem = problemStatements.find(p => p.id === selectedProblem);
    if (!event?.sheet_id) {
      alert('No spreadsheet configured for this event. Create a sheet from the event page first.');
      return;
    }

    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'exportFromSupabase',
          eventId: selectedEvent,
          problemId: selectedProblem,
          eventName: event?.name,
          problemTitle: problem?.title,
          spreadsheetId: event.sheet_id,
        }),
      });

      if (res.ok) {
        alert('Data exported to Google Sheets successfully!');
      } else {
        console.error('Apps Script export failed:', await res.text());
        alert('Failed to export data. Please try again.');
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data. Please try again.');
    }
  }

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
          <h1 className="text-4xl font-bold text-white">Registration Management</h1>
          <p className="text-gray-300 mt-2">View and manage user registrations</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div>
            <h2 className="text-xl font-bold text-red-500 mb-4">Select Event</h2>
            <div className="space-y-2">
              {events.map((event) => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event.id)}
                  className={`w-full text-left p-4 rounded-lg transition-all ${
                    selectedEvent === event.id
                      ? 'bg-red-700 text-white'
                      : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  {event.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-red-500 mb-4">Select Problem Statement</h2>
            {!selectedEvent ? (
              <p className="text-gray-500">Select an event first</p>
            ) : (
              <div className="space-y-2">
                {problemStatements.map((problem) => (
                  <button
                    key={problem.id}
                    onClick={() => setSelectedProblem(problem.id)}
                    className={`w-full text-left p-4 rounded-lg transition-all ${
                      selectedProblem === problem.id
                        ? 'bg-red-700 text-white'
                        : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    {problem.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-bold text-red-500 mb-4">Actions</h2>
            <button
              onClick={exportToSheets}
              disabled={!selectedProblem || registrations.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export to Google Sheets
            </button>
            <p className="text-gray-500 text-sm mt-2">
              Exports registrations to a Google Sheet
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="text-red-600 text-xl">Loading registrations...</div>
          </div>
        ) : selectedProblem && registrations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No registrations yet for this problem statement</p>
          </div>
        ) : selectedProblem ? (
          <div className="bg-gray-900 border-2 border-red-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-red-900">
                  <tr>
                    <th className="px-4 py-3 text-left">Team Name</th>
                    <th className="px-4 py-3 text-left">College</th>
                    <th className="px-4 py-3 text-left">Contact</th>
                    <th className="px-4 py-3 text-left">Team Size</th>
                    <th className="px-4 py-3 text-left">Members</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((reg, index) => (
                    <tr
                      key={reg.id}
                      className={index % 2 === 0 ? 'bg-gray-800' : 'bg-gray-850'}
                    >
                      <td className="px-4 py-3">{reg.team_name}</td>
                      <td className="px-4 py-3">{reg.college_name}</td>
                      <td className="px-4 py-3">{reg.contact_number}</td>
                      <td className="px-4 py-3">{reg.team_size}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {reg.team_members.map((member, idx) => (
                            <div key={idx} className="text-gray-300">
                              {idx === 0 ? '👑 ' : '• '}{member}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold ${
                          reg.is_locked
                            ? 'bg-yellow-900 text-yellow-400'
                            : 'bg-green-900 text-green-400'
                        }`}>
                          {reg.is_locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                          {reg.is_locked ? 'Locked' : 'Unlocked'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleLock(reg)}
                          className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${
                            reg.is_locked
                              ? 'bg-green-700 hover:bg-green-600 text-white'
                              : 'bg-yellow-700 hover:bg-yellow-600 text-white'
                          }`}
                        >
                          {reg.is_locked ? 'Unlock' : 'Lock'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-gray-500">Select an event and problem statement to view registrations</p>
          </div>
        )}
      </main>
    </div>
  );
}
