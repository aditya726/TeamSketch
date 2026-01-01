import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

const RegisterPage = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/register', formData);
      login(data.data);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">Create Account</h2>
        
        {error && <div className="bg-red-50 text-red-500 p-3 rounded-lg mb-4 text-sm text-center">{error}</div>}

        <form onSubmit={handleRegister} className="space-y-4">
          <input 
            type="text" placeholder="Username" required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500"
            value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})}
          />
          <input 
            type="email" placeholder="Email" required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500"
            value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
          <input 
            type="password" placeholder="Password" required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg outline-none focus:border-indigo-500"
            value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
          />
          <button 
            type="submit" disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition font-bold"
          >
             {isLoading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account? <Link to="/login" className="text-indigo-600 hover:underline font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;