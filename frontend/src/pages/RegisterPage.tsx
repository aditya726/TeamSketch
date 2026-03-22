import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PencilLine, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { FloatingDoodles } from '../components/FloatingDoodles';
import api from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

const RegisterPage = () => {
  const [formData, setFormData] = useState({ username: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
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

  const handleGoogleLogin = () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    window.location.href = `${baseUrl}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-architects relative overflow-hidden flex flex-col">
      <FloatingDoodles />

      <nav className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center -rotate-3 shadow-lg">
            <PencilLine className="text-white" size={24} />
          </div>
          <h1 className="text-3xl font-gloria font-bold text-indigo-600 tracking-tight">
            TeamSketch
          </h1>
        </Link>
        <Link to="/" className="flex items-center gap-2 text-zinc-500 hover:text-indigo-600 font-medium transition-colors">
          <ArrowLeft size={18} />
          Back to Home
        </Link>
      </nav>

      <main className="relative z-10 flex-grow flex items-center justify-center p-4">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] border-4 border-zinc-900 p-8"
        >
          <h2 className="text-4xl font-gloria font-bold text-center text-zinc-900 mb-8">Create Account</h2>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-500 p-3 rounded-xl mb-4 text-sm text-center font-medium">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-zinc-200 text-zinc-700 py-3 rounded-xl hover:bg-zinc-50 hover:border-zinc-300 transition-all font-bold mb-6 active:scale-95"
            type="button"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            <span>Sign up with Google</span>
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-zinc-100"></div></div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-zinc-400 font-bold">OR</span>
            </div>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <input
              type="text" placeholder="Username" required
              className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl outline-none focus:border-indigo-500 transition-colors font-medium text-zinc-900 placeholder-zinc-400"
              value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
            <input
              type="email" placeholder="Email" required
              className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl outline-none focus:border-indigo-500 transition-colors font-medium text-zinc-900 placeholder-zinc-400"
              value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"} placeholder="Password" required
                className={`w-full px-4 py-3 border-2 border-zinc-200 rounded-xl outline-none focus:border-indigo-500 transition-colors font-medium text-zinc-900 placeholder-zinc-400 ${!showPassword && formData.password.length > 0 ? 'font-sans tracking-widest' : ''}`}
                value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit" disabled={isLoading}
              className="w-full bg-indigo-600 text-white py-3 rounded-xl hover:bg-indigo-700 transition-colors font-bold shadow-lg mt-2"
            >
              {isLoading ? 'Creating Account...' : 'Sign Up'}
            </motion.button>
          </form>
          <p className="mt-8 text-center text-zinc-500 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-bold relative group">
              Log in
              <span className="absolute -bottom-1 left-0 w-full h-0.5 bg-indigo-600 scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></span>
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default RegisterPage;