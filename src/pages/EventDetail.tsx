import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { supabase, Event, ProblemStatement, Registration } from '../lib/supabase';
import { useSheetSync } from '../hooks/useSheetSync';
import { ArrowLeft, Users, Building2, Phone, CheckCircle, Loader2 } from 'lucide-react';

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const regCode = new URLSearchParams(location.search).get('regCode');
  const [event, setEvent] = useState<Event | null>(null);
  const [problemStatements, setProblemStatements] = useState<ProblemStatement[]>([]);
  const [existingRegistration, setExistingRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState(() => {
    // Only try to restore local storage if we don't have a regCode
    if (!regCode) {
      const savedData = localStorage.getItem(`eventForm_${eventId}`);
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed && typeof parsed === 'object') {
            return {
              problemStatementId: parsed.problemStatementId || '',
              teamName: parsed.teamName || '',
              collegeName: parsed.collegeName || '',
              contactNumber: parsed.contactNumber || '',
              email: parsed.email || '',
              teamSize: parsed.teamSize || 1,
              teamMembers: Array.isArray(parsed.teamMembers) ? parsed.teamMembers : ['']
            };
          }
        } catch (e) {
          console.error('Error parsing saved form data:', e);
        }
      }
    }
    // Default state for new registrations
    return {
      problemStatementId: '',
      teamName: '',
      collegeName: '',
      contactNumber: '',
      email: '',
      teamSize: 1,
      teamMembers: ['']
    };
  });

  const { upsert, syncing, error: syncError } = useSheetSync();

  // Save form data to local storage whenever it changes
  useEffect(() => {
    if (formData.teamName || formData.collegeName || formData.teamMembers.some((m: string) => m)) {
      localStorage.setItem(`eventForm_${eventId}`, JSON.stringify(formData));
    }
  }, [formData, eventId]);

  // Effect to handle URL changes (including regCode changes)
  useEffect(() => {
    console.log('URL parameters changed - eventId:', eventId, 'regCode:', regCode);
    setLoading(true); // Ensure loading is set to true on parameter change
    setExistingRegistration(null); // Reset existing registration
    setFormData({ // Reset form data
      problemStatementId: '',
      teamName: '',
      collegeName: '',
      contactNumber: '',
      email: '',
      teamSize: 1,
      teamMembers: ['']
    });
    
    fetchEventData().catch(error => {
      console.error('Error fetching data:', error);
      setLoading(false);
    });

    // Cleanup on unmount - clear saved form data
    return () => {
      if (success) {
        localStorage.removeItem(`eventForm_${eventId}`);
      }
    };
  }, [eventId, regCode]); // Removed success dependency to prevent reloading on success

  async function fetchEventData() {
    try {
      setLoading(true);

      // First check if we have a reg_code and fetch that registration
      let registration = null;
      if (regCode) {
        console.log('Fetching registration with reg_code:', regCode);
        const registrationRes = await supabase
          .from('registrations')
          .select('*')
          .eq('reg_code', regCode)
          .single();

        if (registrationRes.error) {
          console.error('Error fetching registration:', registrationRes.error);
        } else {
          console.log('Found registration:', registrationRes.data);
          registration = registrationRes.data;
          // If this registration is for a different event, navigate to the correct event
          if (registration.event_id !== eventId) {
            console.log('Registration is for a different event, redirecting...');
            navigate(`/events/${registration.event_id}?regCode=${regCode}`);
            return;
          }
        }
      }

      // Then fetch event and problem statements
      const [eventRes, problemsRes] = await Promise.all([
        supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
        supabase.from('problem_statements').select('*').eq('event_id', eventId)
      ]);

      if (eventRes.error) throw eventRes.error;
      if (problemsRes.error) throw problemsRes.error;

      setEvent(eventRes.data);
      setProblemStatements(problemsRes.data || []);

      if (registration) {
        // Remove any stale form data since we have registration data
        localStorage.removeItem(`eventForm_${eventId}`);
        
        setExistingRegistration(registration);
        setFormData({
          problemStatementId: registration.problem_statement_id,
          teamName: registration.team_name,
          collegeName: registration.college_name,
          contactNumber: registration.contact_number,
          email: registration.email || '',
          teamSize: registration.team_size || registration.team_members?.length || 1,
          teamMembers: registration.team_members || ['']
        });

        // Show which problem statement this registration is for
        const problemTitle = problemsRes.data?.find(p => p.id === registration.problem_statement_id)?.title;
        if (problemTitle) {
          console.log(`Loaded registration for problem: ${problemTitle}`);
        }
      }
    } catch (error) {
      console.error('Error fetching event data:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleTeamSizeChange(size: number) {
    const newMembers = Array(size).fill('');
    if (formData.teamMembers.length > 0) {
      formData.teamMembers.forEach((member: string, idx: number) => {
        if (idx < size) newMembers[idx] = member;
      });
    }
    setFormData({ ...formData, teamSize: size, teamMembers: newMembers });
  }

  function handleMemberChange(index: number, value: string) {
    const newMembers = [...formData.teamMembers];
    newMembers[index] = value;
    setFormData({ ...formData, teamMembers: newMembers });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Generate a unique registration code if one doesn't exist
      const newRegCode = regCode || Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const registration = {
        ...(existingRegistration?.id ? { id: existingRegistration.id } : {}),
        event_id: eventId!,
        problem_statement_id: formData.problemStatementId,
        team_name: formData.teamName,
        college_name: formData.collegeName,
        contact_number: formData.contactNumber,
        email: formData.email,
        team_members: formData.teamMembers.filter((member: string) => member.trim()),
        team_size: formData.teamSize,
        reg_code: newRegCode,
        ...(existingRegistration?.is_locked ? { is_locked: true } : { is_locked: false })
      };

      const { error } = await supabase.from('registrations').upsert(registration);
      if (error) throw error;

      // Get attendance URL from function
      const { data: urlData, error: urlError } = await supabase.rpc('get_team_attendance_url', {
        reg_code: newRegCode
      });
      if (urlError) throw urlError;

      // Copy attendance URL to clipboard
      await navigator.clipboard.writeText(urlData);
      alert('Attendance URL copied to clipboard!');

      // Ensure reg_code persisted in DB and then trigger sheet upsert
      const { data: regData } = await supabase
        .from('registrations')
        .select('id, reg_code')
        .eq('event_id', eventId)
        .eq('reg_code', newRegCode)
        .maybeSingle();

      if (regData && regData.id) {
        // Trigger the sync manager upsert which will create sheet/tab if needed and upsert by reg_code
        await upsert(regData.id);

        // Fetch full registration to update local state
        const { data: fullReg } = await supabase.from('registrations').select('*').eq('id', regData.id).maybeSingle();
        if (fullReg) {
          setExistingRegistration(fullReg as Registration);
        }
      }
      setSuccess(true);
      // Update URL and clear local storage
      if (!regCode) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('regCode', newRegCode);
        window.history.replaceState({}, '', newUrl.toString());
      }
      localStorage.removeItem(`eventForm_${eventId}`);
    } catch (error) {
      console.error('Error submitting registration:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto mb-4" />
          <div className="text-red-600 text-xl">Loading registration data...</div>
          {regCode && <div className="text-gray-400 mt-2">Registration Code: {regCode}</div>}
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-600 text-xl">Event not found</div>
      </div>
    );
  }

    // Registration restrictions
    const now = new Date();
    const deadline = event.registration_deadline ? new Date(event.registration_deadline) : undefined;
    const registrationClosed = !event.is_active || (deadline !== undefined && now > deadline);

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-2">Registration Successful!</h2>
          <p className="text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-gradient-to-r from-red-900 to-black border-b-2 border-red-600 py-6">
        <div className="container mx-auto px-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-300 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Events
          </button>
          <h1 className="text-4xl font-bold text-white">{event.name}</h1>
          <p className="text-gray-300 mt-2">{event.description}</p>
            <div className="mt-2 text-sm text-gray-400">
              Max Team Size: <span className="font-bold text-white">{event.max_team_size}</span>
              {event.registration_deadline && (
                <span className="ml-4">Registration Deadline: <span className="font-bold text-white">{new Date(event.registration_deadline).toLocaleDateString()}</span></span>
              )}
              {!event.is_active && <span className="ml-4 text-red-400">Registrations Disabled</span>}
            </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
          {registrationClosed && (
            <div className="bg-red-900/30 border border-red-600 rounded-lg p-4 mb-6">
              <p className="text-red-400 font-semibold">Registration is closed for this event.</p>
            </div>
          )}
        {existingRegistration?.is_locked && (
          <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-4 mb-6">
            <p className="text-yellow-400 font-semibold">⚠️ Your registration is locked by the admin. You cannot make changes.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto bg-gradient-to-br from-gray-900 to-black border-2 border-red-800 rounded-lg p-8">
         {/* Registration form is disabled if registrationClosed */}
          <h2 className="text-2xl font-bold text-red-500 mb-6">
            {existingRegistration ? 'Edit Registration' : 'Team Registration'}
          </h2>

          <div className="mb-6">
            <label className="block text-gray-300 font-semibold mb-2">
              Select Problem Statement *
            </label>
            <select
              required
              disabled={existingRegistration?.is_locked}
              value={formData.problemStatementId}
              onChange={(e) => setFormData({ ...formData, problemStatementId: e.target.value })}
              className="w-full bg-gray-800 border border-red-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">Choose a problem statement</option>
              {problemStatements.map((ps) => (
                <option key={ps.id} value={ps.id}>
                  {ps.title}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 font-semibold mb-2">
              <Users className="inline w-4 h-4 mr-1" />
              Team Name *
            </label>
            <input
              type="text"
              required
              disabled={existingRegistration?.is_locked}
              value={formData.teamName}
              onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
              className="w-full bg-gray-800 border border-red-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your team name"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 font-semibold mb-2">
              <Building2 className="inline w-4 h-4 mr-1" />
              College Name *
            </label>
            <input
              type="text"
              required
              disabled={existingRegistration?.is_locked}
              value={formData.collegeName}
              onChange={(e) => setFormData({ ...formData, collegeName: e.target.value })}
              className="w-full bg-gray-800 border border-red-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your college name"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 font-semibold mb-2">
              <Phone className="inline w-4 h-4 mr-1" />
              Contact Number *
            </label>
            <input
              type="tel"
              required
              disabled={existingRegistration?.is_locked}
              value={formData.contactNumber}
              onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              className="w-full bg-gray-800 border border-red-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter contact number"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 font-semibold mb-2">
              <svg className="inline w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              Email Address *
            </label>
            <input
              type="email"
              required
              disabled={existingRegistration?.is_locked}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-gray-800 border border-red-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Enter your email address"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-300 font-semibold mb-2">
              Number of Team Members *
            </label>
              <select
                required
                disabled={existingRegistration?.is_locked || registrationClosed}
                value={formData.teamSize}
                onChange={(e) => handleTeamSizeChange(Number(e.target.value))}
                className="w-full bg-gray-800 border border-red-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {Array.from({ length: event.max_team_size }, (_, i) => i + 1).map((num) => (
                  <option key={num} value={num}>
                    {num} {num === 1 ? 'Member' : 'Members'}
                  </option>
                ))}
              </select>
          </div>

          {formData.teamSize > 0 && (
            <div className="mb-6 space-y-4">
              <h3 className="text-lg font-semibold text-red-500">Team Members</h3>
              {Array.from({ length: formData.teamSize }).map((_, index) => (
                <div key={index}>
                  <label className="block text-gray-300 font-medium mb-2">
                    {index === 0 ? 'Team Lead' : `Team Member ${index + 1}`} *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={existingRegistration?.is_locked}
                    value={formData.teamMembers[index] || ''}
                    onChange={(e) => handleMemberChange(index, e.target.value)}
                    className="w-full bg-gray-800 border border-red-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder={`Enter ${index === 0 ? 'team lead' : 'member'} name`}
                  />
                </div>
              ))}
            </div>
          )}

          <button
              type="submit"
              disabled={submitting || existingRegistration?.is_locked || registrationClosed}
              className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {registrationClosed
                ? 'Registration Closed'
                : submitting
                  ? 'Submitting...'
                  : existingRegistration
                    ? 'Update Registration'
                    : 'Submit Registration'}
            </button>
        </form>
      </main>

      {(submitting || syncing) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg flex items-center gap-2">
            <Loader2 className="animate-spin" />
            <span>{syncing ? 'Syncing to sheets...' : 'Submitting registration...'}</span>
          </div>
        </div>
      )}

      {syncError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {syncError}</span>
        </div>
      )}
    </div>
  );
}
