import { Link, useNavigate } from 'react-router-dom';
import { motion } from "framer-motion";
import { FloatingDoodles } from "../components/FloatingDoodles";
import { PencilLine, Sparkles, Zap, Users, User, LogOut } from "lucide-react";
import { useAuthStore } from '../store/useAuthStore';

const LandingPage = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-architects relative overflow-hidden">
      <FloatingDoodles />

      <nav className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex items-center gap-2"
        >
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center -rotate-3 shadow-lg">
            <PencilLine className="text-white" size={24} />
          </div>
          <h1 className="text-3xl font-gloria font-bold text-indigo-600 tracking-tight">
            TeamSketch
          </h1>
        </motion.div>
        
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="space-x-6 flex items-center"
        >
          {isAuthenticated ? (
            <>
              <Link 
                to="/profile" 
                className="flex items-center gap-2 hover:text-indigo-600 transition-colors font-medium"
              >
                <User size={20} />
                <span>{user?.username}</span>
              </Link>
              <button 
                onClick={handleLogout}
                className="bg-zinc-900 text-white px-6 py-2 rounded-full font-bold hover:bg-zinc-800 transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center gap-2"
              >
                <LogOut size={18} />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-indigo-600 transition-colors font-medium">
                Log In
              </Link>
              <Link 
                to="/register" 
                className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                Sign Up
              </Link>
            </>
          )}
        </motion.div>
      </nav>

      <main className="relative z-10 flex-grow flex flex-col items-center justify-center text-center px-4 py-20 min-h-[calc(100vh-88px)]">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium mb-8"
          >
            <Sparkles size={16} />
            <span>The new way to brainstorm together</span>
          </motion.div>

          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-6xl md:text-8xl font-gloria font-extrabold text-zinc-900 mb-8 leading-[1.1]"
          >
            Collaborate <span className="text-indigo-600 relative inline-block">
              freely
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 10" preserveAspectRatio="none">
                <path d="M0,5 Q50,0 100,5 T200,5" fill="none" stroke="currentColor" strokeWidth="3" />
              </svg>
            </span>, <br />
            Sync instantly.
          </motion.h2>

          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-zinc-600 max-w-2xl mx-auto mb-12 leading-relaxed"
          >
            The secure, hand-drawn whiteboard for high-performance teams. 
            Real-time, low-latency, and built for creativity.
          </motion.p>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          >
            <Link 
              to="/whiteboard" 
              className="group relative px-10 py-5 bg-zinc-900 text-white rounded-2xl font-bold text-xl hover:bg-zinc-800 transition-all shadow-xl hover:shadow-2xl active:scale-95"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start Sketching Now
                <Zap size={20} className="group-hover:text-yellow-400 transition-colors" />
              </span>
              <div className="absolute inset-0 bg-indigo-600 rounded-2xl -rotate-2 -z-10 group-hover:rotate-0 transition-transform" />
            </Link>
            
            <div className="flex items-center gap-4 text-zinc-500 font-medium">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-zinc-100 flex items-center justify-center overflow-hidden">
                    <img 
                      src={`https://images.unsplash.com/photo-${1535713875002 + i}-d1d4451d6744?w=100&h=100&fit=crop`} 
                      alt="user"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <span className="flex items-center gap-1">
                <Users size={18} />
                Joined by 1,000+ teams
              </span>
            </div>
          </motion.div>
        </div>
        
        {/* Simple visual indicator of a whiteboard */}
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-20 w-full max-w-5xl mx-auto rounded-3xl border-4 border-zinc-900 bg-white shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden aspect-video relative group"
        >
          <div className="absolute inset-0 bg-zinc-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]">
            <p className="text-zinc-400 font-gloria text-2xl">Ready to draw? Click the button above!</p>
          </div>
          <div className="h-12 border-b-4 border-zinc-900 flex items-center px-6 gap-4 bg-zinc-50">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
            <div className="ml-4 h-6 w-32 bg-zinc-200 rounded-md" />
          </div>
          <div className="p-8 grid grid-cols-3 gap-8 opacity-20">
             <div className="h-32 border-2 border-dashed border-zinc-400 rounded-xl" />
             <div className="h-32 border-2 border-dashed border-zinc-400 rounded-xl" />
             <div className="h-32 border-2 border-dashed border-zinc-400 rounded-xl" />
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 py-12 text-center text-zinc-400 font-medium">
        <p>&copy; {new Date().getFullYear()} TeamSketch. Built for thinkers and doers.</p>
      </footer>
    </div>
  );
};

export default LandingPage;