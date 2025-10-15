import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, Event } from '../lib/supabase';
import { Calendar, Users } from 'lucide-react';

export default function UserDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-600 text-xl">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="bg-gradient-to-r from-red-900 to-black border-b-2 border-red-600 py-6">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold text-white">Event Registration Portal</h1>
          <p className="text-gray-300 mt-2">Select an event to register your team</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {events.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-16 h-16 mx-auto text-red-600 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-300">No Events Available</h2>
            <p className="text-gray-500 mt-2">Check back later for upcoming events</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/event/${event.id}`)}
                className="bg-gradient-to-br from-gray-900 to-black border-2 border-red-800 rounded-lg p-6 cursor-pointer hover:border-red-600 hover:shadow-xl hover:shadow-red-900/50 transition-all duration-300 transform hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-2xl font-bold text-red-500">{event.name}</h2>
                  <Users className="w-6 h-6 text-red-600" />
                </div>
                <p className="text-gray-300 mb-4 line-clamp-3">{event.description}</p>
                <button className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded transition-colors duration-200">
                  View Details & Register
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
