import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Event, ProblemStatement } from '../lib/supabase';
import { useAdmin } from '../contexts/AdminContext';
import { useSheetSync } from '../hooks/useSheetSync';
import { Plus, Calendar, Users, FileText, Download, Sheet, Clock, CheckCircle, XCircle, Trash2, Edit2, X } from 'lucide-react';

export default function AdminDashboard() {
  const { isAdmin } = useAdmin();
  const navigate = useNavigate();
  const { ensureEvent, ensureTab } = useSheetSync();

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProblems, setLoadingProblems] = useState(false);

  // Modals
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [showCreateProblem, setShowCreateProblem] = useState(false);
  const [showEditProblem, setShowEditProblem] = useState(false);

  // Form states
  const [eventForm, setEventForm] = useState({
    name: '',
    description: '',
    max_team_size: 4,
    is_active: true,
    registration_deadline: ''
  });

  const [problemForm, setProblemForm] = useState({
    title: '',
    description: ''
  });

  const [editingProblem, setEditingProblem] = useState<ProblemStatement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/admin');
    } else {
      fetchEvents();
    }
  }, [isAdmin, navigate]);

  async function fetchEvents() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
      
      if (data && data.length > 0 && !selectedEvent) {
        handleSelectEvent(data[0]);
      }
    } catch (err) {
      console.error('Failed to fetch events', err);
      setError((err as Error)?.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  }

  async function fetchProblemStatements(eventId: string) {
    setLoadingProblems(true);
    try {
      const { data, error } = await supabase
        .from('problem_statements')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProblemStatements(data || []);
    } catch (err) {
      console.error('Failed to fetch problem statements', err);
    } finally {
      setLoadingProblems(false);
    }
  }

  function isPastEvent(ev: Event) {
    if (!ev.is_active) return true;
    if (!ev.registration_deadline) return false;
    try {
      return new Date(ev.registration_deadline) < new Date();
    } catch {
      return false;
    }
  }

  function handleSelectEvent(event: Event) {
    setSelectedEvent(event);
    fetchProblemStatements(event.id);
  }

  // Event CRUD operations
  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventForm.name.trim()) {
      setError('Event name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          name: eventForm.name.trim(),
          description: eventForm.description.trim(),
          max_team_size: eventForm.max_team_size,
          is_active: eventForm.is_active,
          registration_deadline: eventForm.registration_deadline || null
        })
        .select('*')
        .single();
      
      if (error) throw error;

      if (data) {
        await ensureEvent(data.id);
      }

      await fetchEvents();
      setShowCreateEvent(false);
      resetEventForm();
    } catch (err) {
      console.error('Failed to create event', err);
      setError((err as Error)?.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!eventForm.name.trim()) {
      setError('Event name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('events')
        .update({
          name: eventForm.name.trim(),
          description: eventForm.description.trim(),
          max_team_size: eventForm.max_team_size,
          is_active: eventForm.is_active,
          registration_deadline: eventForm.registration_deadline || null
        })
        .eq('id', selectedEvent.id);
      
      if (error) throw error;

      await fetchEvents();
      const updatedEvent = events.find(e => e.id === selectedEvent.id);
      if (updatedEvent) {
        setSelectedEvent({...updatedEvent, ...eventForm});
      }
      setShowEditEvent(false);
    } catch (err) {
      console.error('Failed to update event', err);
      setError((err as Error)?.message || 'Failed to update event');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(eventId: string) {
    if (!confirm('Are you sure you want to delete this event? This will also delete all associated problem statements and registrations.')) {
      return;
    }
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);
      
      if (error) throw error;

      await fetchEvents();
      if (selectedEvent?.id === eventId) {
        setSelectedEvent(null);
        setProblemStatements([]);
      }
    } catch (err) {
      console.error('Failed to delete event', err);
      alert('Failed to delete event. See console for details.');
    }
  }

  // Problem Statement CRUD operations
  async function handleCreateProblem(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEvent) return;
    if (!problemForm.title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('problem_statements')
        .insert({
          event_id: selectedEvent.id,
          title: problemForm.title.trim(),
          description: problemForm.description.trim()
        })
        .select('*')
        .single();

      if (error) throw error;

      if (data && data.id) {
        try {
          await ensureTab(selectedEvent.id, data.id);
        } catch (tabErr) {
          console.error('Failed to create sheet tab for problem statement:', tabErr);
          setError('Problem created, but failed to create sheet tab.');
        }
      }

      await fetchProblemStatements(selectedEvent.id);
      setShowCreateProblem(false);
      resetProblemForm();
    } catch (err) {
      console.error('Failed to create problem statement', err);
      setError((err as Error)?.message || 'Failed to create problem statement');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateProblem(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProblem) return;
    if (!problemForm.title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { error } = await supabase
        .from('problem_statements')
        .update({
          title: problemForm.title.trim(),
          description: problemForm.description.trim()
        })
        .eq('id', editingProblem.id);
      
      if (error) throw error;

      await fetchProblemStatements(selectedEvent!.id);
      setShowEditProblem(false);
      setEditingProblem(null);
      resetProblemForm();
    } catch (err) {
      console.error('Failed to update problem statement', err);
      setError((err as Error)?.message || 'Failed to update problem statement');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProblem(problemId: string) {
    if (!confirm('Are you sure you want to delete this problem statement?')) {
      return;
    }
    try {
      const { error } = await supabase
        .from('problem_statements')
        .delete()
        .eq('id', problemId);
      
      if (error) throw error;

      await fetchProblemStatements(selectedEvent!.id);
    } catch (err) {
      console.error('Failed to delete problem statement', err);
      alert('Failed to delete problem statement. See console for details.');
    }
  }

  function openEditEvent() {
    if (!selectedEvent) return;
    setEventForm({
      name: selectedEvent.name,
      description: selectedEvent.description || '',
      max_team_size: selectedEvent.max_team_size,
      is_active: selectedEvent.is_active,
      registration_deadline: selectedEvent.registration_deadline || ''
    });
    setShowEditEvent(true);
    setError(null);
  }

  function openEditProblem(problem: ProblemStatement) {
    setEditingProblem(problem);
    setProblemForm({
      title: problem.title,
      description: problem.description || ''
    });
    setShowEditProblem(true);
    setError(null);
  }

  function resetEventForm() {
    setEventForm({
      name: '',
      description: '',
      max_team_size: 4,
      is_active: true,
      registration_deadline: ''
    });
  }

  function resetProblemForm() {
    setProblemForm({
      title: '',
      description: ''
    });
  }

  async function handleEnsureSheet(eventId: string) {
    try {
      await ensureEvent(eventId);
      alert('Spreadsheet ensured for event.');
      await fetchEvents();
    } catch (err) {
      console.error('Failed to ensure spreadsheet', err);
      alert('Failed to ensure spreadsheet. See console for details.');
    }
  }

  async function handleExport(eventId: string) {
    try {
      const res = await fetch('/api/sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exportFromSupabase', eventId }),
      });
      if (!res.ok) throw new Error(await res.text());
      alert('Export started — check Google Sheets shortly.');
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed. See console for details.');
    }
  }

  const activeEvents = events.filter(e => !isPastEvent(e));
  const pastEvents = events.filter(e => isPastEvent(e));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-black to-gray-900 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-900/20 to-black border-b border-red-900/30 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-500 to-red-300 bg-clip-text text-transparent">
                Admin Dashboard
              </h1>
              <p className="text-gray-400 text-sm mt-1">Manage events and problem statements</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  resetEventForm();
                  setShowCreateEvent(true);
                  setError(null);
                }}
                className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-medium rounded-lg transition-all shadow-lg shadow-red-900/30"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                New Event
              </button>
              <button
                onClick={() => navigate('/admin/registrations')}
                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all"
              >
                Registrations
              </button>
              <button
                onClick={() => navigate('/admin/attendance')}
                className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all"
              >
                Attendance
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-red-500 text-lg">Loading events...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar - Events List */}
            <div className="lg:col-span-4 space-y-6">
              {activeEvents.length > 0 && (
                <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h2 className="text-lg font-semibold text-gray-200">Active Events</h2>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full ml-auto">
                      {activeEvents.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {activeEvents.map(event => (
                      <EventCard
                        key={event.id}
                        event={event}
                        isSelected={selectedEvent?.id === event.id}
                        onClick={() => handleSelectEvent(event)}
                        onDelete={() => handleDeleteEvent(event.id)}
                        isActive={true}
                      />
                    ))}
                  </div>
                </div>
              )}

              {pastEvents.length > 0 && (
                <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <XCircle className="w-5 h-5 text-gray-500" />
                    <h2 className="text-lg font-semibold text-gray-200">Past Events</h2>
                    <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full ml-auto">
                      {pastEvents.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pastEvents.map(event => (
                      <EventCard
                        key={event.id}
                        event={event}
                        isSelected={selectedEvent?.id === event.id}
                        onClick={() => handleSelectEvent(event)}
                        onDelete={() => handleDeleteEvent(event.id)}
                        isActive={false}
                      />
                    ))}
                  </div>
                </div>
              )}

              {events.length === 0 && !loading && (
                <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-8 text-center">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">No events yet</p>
                  <button
                    onClick={() => {
                      resetEventForm();
                      setShowCreateEvent(true);
                      setError(null);
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
                  >
                    Create First Event
                  </button>
                </div>
              )}
            </div>

            {/* Right Content - Event Details & Problem Statements */}
            <div className="lg:col-span-8">
              {selectedEvent ? (
                <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-6">
                  {/* Event Details Header */}
                  <div className="mb-6 pb-6 border-b border-gray-800">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-white mb-2">{selectedEvent.name}</h2>
                        <p className="text-gray-400">{selectedEvent.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPastEvent(selectedEvent) && (
                          <span className="px-3 py-1 bg-gray-500/20 text-gray-400 text-sm rounded-full border border-gray-600">
                            Inactive
                          </span>
                        )}
                        <button
                          onClick={openEditEvent}
                          className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all"
                          title="Edit Event"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Users className="w-4 h-4" />
                        <span>Max: {selectedEvent.max_team_size}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(selectedEvent.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{selectedEvent.registration_deadline ? new Date(selectedEvent.registration_deadline).toLocaleDateString() : 'No deadline'}</span>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleEnsureSheet(selectedEvent.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all text-sm"
                      >
                        <Sheet className="w-4 h-4" />
                        Ensure Sheet
                      </button>
                      <button
                        onClick={() => handleExport(selectedEvent.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-all text-sm"
                      >
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                      <button
                        onClick={() => {
                          resetProblemForm();
                          setShowCreateProblem(true);
                          setError(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-lg transition-all text-sm ml-auto"
                      >
                        <Plus className="w-4 h-4" />
                        New Problem
                      </button>
                    </div>
                  </div>

                  {/* Problem Statements */}
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-5 h-5 text-red-500" />
                      <h3 className="text-xl font-semibold text-white">Problem Statements</h3>
                      <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                        {problemStatements.length}
                      </span>
                    </div>

                    {loadingProblems ? (
                      <div className="text-center py-12 text-gray-400">Loading problem statements...</div>
                    ) : problemStatements.length > 0 ? (
                      <div className="space-y-3">
                        {problemStatements.map(ps => (
                          <ProblemCard 
                            key={ps.id} 
                            problem={ps}
                            onEdit={() => openEditProblem(ps)}
                            onDelete={() => handleDeleteProblem(ps.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16 bg-gray-800/30 rounded-lg border border-dashed border-gray-700">
                        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 mb-4">No problem statements yet</p>
                        <button
                          onClick={() => {
                            resetProblemForm();
                            setShowCreateProblem(true);
                            setError(null);
                          }}
                          className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-all"
                        >
                          Create First Problem
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-16 text-center">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-gray-700" />
                  <p className="text-lg text-gray-400">Select an event to view details</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create Event Modal */}
        {showCreateEvent && (
          <Modal onClose={() => setShowCreateEvent(false)} title="Create New Event">
            <form onSubmit={handleCreateEvent}>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Event Name *</label>
                  <input
                    value={eventForm.name}
                    onChange={(e) => setEventForm({...eventForm, name: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all"
                    placeholder="Enter event name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Description</label>
                  <textarea
                    value={eventForm.description}
                    onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all resize-none"
                    rows={3}
                    placeholder="Enter event description (optional)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 mb-2 text-sm font-medium">Max Team Size</label>
                    <input
                      type="number"
                      min="1"
                      value={eventForm.max_team_size}
                      onChange={(e) => setEventForm({...eventForm, max_team_size: parseInt(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2 text-sm font-medium">Registration Deadline</label>
                    <input
                      type="datetime-local"
                      value={eventForm.registration_deadline}
                      onChange={(e) => setEventForm({...eventForm, registration_deadline: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={eventForm.is_active}
                    onChange={(e) => setEventForm({...eventForm, is_active: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="is_active" className="text-gray-300 text-sm">Active Event</label>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-600 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateEvent(false)}
                  className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-all"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </Modal>
        )}
        
        {/* Edit Event Modal */}
        {showEditEvent && (
          <Modal onClose={() => setShowEditEvent(false)} title="Edit Event">
            <form onSubmit={handleUpdateEvent}>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Event Name *</label>
                  <input
                    value={eventForm.name}
                    onChange={(e) => setEventForm({...eventForm, name: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all"
                    placeholder="Enter event name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Description</label>
                  <textarea
                    value={eventForm.description}
                    onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all resize-none"
                    rows={3}
                    placeholder="Enter event description (optional)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 mb-2 text-sm font-medium">Max Team Size</label>
                    <input
                      type="number"
                      min="1"
                      value={eventForm.max_team_size}
                      onChange={(e) => setEventForm({...eventForm, max_team_size: parseInt(e.target.value)})}
                      className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2 text-sm font-medium">Registration Deadline</label>
                    <input
                      type="datetime-local"
                      value={eventForm.registration_deadline}
                      onChange={(e) => setEventForm({...eventForm, registration_deadline: e.target.value})}
                      className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={eventForm.is_active}
                    onChange={(e) => setEventForm({...eventForm, is_active: e.target.checked})}
                    className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-red-600 focus:ring-red-500"
                  />
                  <label htmlFor="edit_is_active" className="text-gray-300 text-sm">Active Event</label>
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-600 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditEvent(false)}
                  className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-all"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Updating...' : 'Update Event'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Create Problem Modal */}
        {showCreateProblem && (
          <Modal onClose={() => setShowCreateProblem(false)} title="Create Problem Statement">
            <form onSubmit={handleCreateProblem}>
              <p className="text-sm text-gray-400 mb-4">
                Add a new problem statement for <span className="text-red-400">{selectedEvent?.name}</span>
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Title *</label>
                  <input
                    value={problemForm.title}
                    onChange={(e) => setProblemForm({...problemForm, title: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all"
                    placeholder="Enter problem statement title"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Description</label>
                  <textarea
                    value={problemForm.description}
                    onChange={(e) => setProblemForm({...problemForm, description: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all resize-none"
                    rows={5}
                    placeholder="Enter problem statement description (optional)"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-600 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateProblem(false)}
                  className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-all"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating...' : 'Create & Sync'}
                </button>
              </div>
            </form>
          </Modal>
        )}

        {/* Edit Problem Modal */}
        {showEditProblem && (
          <Modal onClose={() => setShowEditProblem(false)} title="Edit Problem Statement">
            <form onSubmit={handleUpdateProblem}>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Title *</label>
                  <input
                    value={problemForm.title}
                    onChange={(e) => setProblemForm({...problemForm, title: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all"
                    placeholder="Enter problem statement title"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-300 mb-2 text-sm font-medium">Description</label>
                  <textarea
                    value={problemForm.description}
                    onChange={(e) => setProblemForm({...problemForm, description: e.target.value})}
                    className="w-full bg-gray-800 border border-gray-700 focus:border-red-500 rounded-lg px-4 py-3 text-white outline-none transition-all resize-none"
                    rows={5}
                    placeholder="Enter problem statement description (optional)"
                  />
                </div>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-600 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setShowEditProblem(false)}
                  className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-all"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-lg text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Updating...' : 'Update Problem'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </main>
    </div>
  );
}

// Modal Component
function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-gradient-to-br from-gray-900 to-black border-2 border-red-900/50 rounded-2xl p-8 w-full max-w-2xl shadow-2xl shadow-red-900/20 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-all text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// Event Card Component
function EventCard({ event, isSelected, onClick, onDelete, isActive }: { event: Event; isSelected: boolean; onClick: () => void; onDelete: () => void; isActive: boolean; }) {
  return (
    <div
      className={`relative group text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${
        isSelected
          ? 'bg-gradient-to-br from-red-900/40 to-red-800/20 border-red-600 shadow-lg shadow-red-900/30'
          : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
      }`}
      onClick={onClick}
    >
      <div className="w-full text-left">
        <div className="flex items-start justify-between mb-2">
          <h3 className={`font-semibold pr-8 ${isSelected ? 'text-white' : 'text-gray-200'}`}>
            {event.name}
          </h3>
          {isActive && (
            <span className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0 mt-1.5"></span>
          )}
        </div>
        <p className={`text-sm line-clamp-2 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>
          {event.description}
        </p>
        <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{event.max_team_size}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{new Date(event.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 p-1.5 bg-red-900/50 hover:bg-red-800 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
        title="Delete Event"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-300" />
      </button>
    </div>
  );
}

// Problem Card Component
function ProblemCard({ problem, onEdit, onDelete }: { problem: ProblemStatement; onEdit: () => void; onDelete: () => void;}) {
  return (
    <div className="relative group bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-5 hover:border-red-900/50 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-16">
          <h4 className="text-lg font-semibold text-white mb-2 group-hover:text-red-400 transition-colors">
            {problem.title}
          </h4>
          {problem.description && (
            <p className="text-sm text-gray-400 leading-relaxed">{problem.description}</p>
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Sheet className="w-3.5 h-3.5" />
          <span>{problem.sheet_tab_name || 'No Sheet Tab'}</span>
        </div>
        <div className="text-xs text-gray-500">
          {new Date(problem.created_at).toLocaleDateString()}
        </div>
      </div>

      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
        <button
          onClick={onEdit}
          className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all"
          title="Edit Problem"
        >
          <Edit2 className="w-3.h-3.5 text-white" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 bg-red-900/50 hover:bg-red-800 rounded-lg transition-all"
          title="Delete Problem"
        >
          <Trash2 className="w-3.5 h-3.5 text-red-300" />
        </button>
      </div>
    </div>
  );
}