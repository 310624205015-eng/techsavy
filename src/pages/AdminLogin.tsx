import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';
import { Lock, User } from 'lucide-react';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdmin();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(username, password);

    if (success) {
      navigate('/admin/dashboard');
    } else {
      setError('Invalid username or password');
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-red-900/30 rounded-full mb-4">
            <Lock className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-gray-400">Sign in to manage events and registrations</p>
        </div>

        <div className="bg-gradient-to-br from-gray-900 to-black border-2 border-red-800 rounded-lg p-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-gray-300 font-semibold mb-2">
                <User className="inline w-4 h-4 mr-1" />
                Username
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800 border border-red-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
                placeholder="Enter username"
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-300 font-semibold mb-2">
                <Lock className="inline w-4 h-4 mr-1" />
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-red-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-600 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">
              Default credentials: admin / admin123
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
