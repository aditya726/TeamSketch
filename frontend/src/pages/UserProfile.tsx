import { motion } from "framer-motion";
import { useAuthStore } from '../store/useAuthStore';
import { User, Mail, Calendar, ArrowLeft, Users } from "lucide-react";
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';
import { getUserStatsView, incrementSketches, type UserStatsView } from '../services/userStats';

const UserProfile = () => {
  const [stats, setStats] = useState<{ totalUsers: number, sampleUsers: any[] }>({ totalUsers: 0, sampleUsers: [] });
  const [activityStats, setActivityStats] = useState<UserStatsView>({
    sketches: 0,
    collaborations: 0,
    whiteboardMsTotal: 0,
    hoursTotal: 0,
    isWhiteboardSessionActive: false,
  });
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/auth/stats');
        if (response.data.success) {
          setStats(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    fetchStats();
  }, []);

  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;

    const refresh = () => setActivityStats(getUserStatsView(userId));
    refresh();

    const onStorage = (e: StorageEvent) => {
      if (e.key === `teamsketch:user-stats:${userId}`) refresh();
    };

    const onVisibilityChange = () => {
      if (!document.hidden) refresh();
    };

    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user?.id]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return null;
  }

  const hoursDisplay = (() => {
    const hours = activityStats.hoursTotal;
    if (!Number.isFinite(hours) || hours <= 0) return '0';
    const pretty = hours < 10 ? hours.toFixed(1) : Math.round(hours).toString();
    return pretty.replace(/\.0$/, '');
  })();

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-architects relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-30" />

      <nav className="relative z-10 p-6 flex justify-between items-center max-w-7xl mx-auto w-full">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center -rotate-3 shadow-lg">
            <span className="text-white text-xl">✏️</span>
          </div>
          <h1 className="text-3xl font-gloria font-bold text-indigo-600 tracking-tight">
            TeamSketch
          </h1>
        </Link>

        <Link
          to="/"
          className="flex items-center gap-2 text-zinc-600 hover:text-indigo-600 transition-colors font-medium"
        >
          <ArrowLeft size={20} />
          Back to Home
        </Link>
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-white rounded-3xl border-4 border-zinc-900 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)] overflow-hidden"
        >
          {/* Header Section */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-8 text-white">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl"
            >
              <User className="text-indigo-600" size={48} />
            </motion.div>
            <h2 className="text-3xl font-gloria font-bold text-center mb-2">
              {user.username}
            </h2>
            <p className="text-indigo-100 text-center text-sm">TeamSketch Member</p>
          </div>

          {/* Profile Information */}
          <div className="p-8 space-y-6">
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-4 p-4 bg-zinc-50 rounded-xl border-2 border-zinc-200"
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <User className="text-indigo-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-zinc-500 font-medium">Username</p>
                <p className="text-lg font-bold text-zinc-900">{user.username}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center gap-4 p-4 bg-zinc-50 rounded-xl border-2 border-zinc-200"
            >
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Mail className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-zinc-500 font-medium">Email Address</p>
                <p className="text-lg font-bold text-zinc-900">{user.email}</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-4 p-4 bg-zinc-50 rounded-xl border-2 border-zinc-200"
            >
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Calendar className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-zinc-500 font-medium">Member Since</p>
                <p className="text-lg font-bold text-zinc-900">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="pt-6 space-y-4"
            >
              <Link
                to="/whiteboard"
                onClick={() => {
                  if (user?.id) {
                    incrementSketches(user.id, 1);
                    setActivityStats(getUserStatsView(user.id));
                  }
                }}
                className="block w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-center hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl active:scale-95"
              >
                Start Sketching
              </Link>

              <button
                onClick={handleLogout}
                className="w-full bg-zinc-100 text-zinc-900 py-4 rounded-xl font-bold hover:bg-zinc-200 transition-all border-2 border-zinc-300 active:scale-95"
              >
                Logout
              </button>
            </motion.div>
          </div>
        </motion.div>

        {/* Stats Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-8 grid grid-cols-3 gap-4"
        >
          <div className="bg-white rounded-xl border-2 border-zinc-900 p-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <p className="text-3xl font-gloria font-bold text-indigo-600">{activityStats.sketches}</p>
            <p className="text-sm text-zinc-600 font-medium mt-1">Sketches</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-zinc-900 p-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <p className="text-3xl font-gloria font-bold text-purple-600">{activityStats.collaborations}</p>
            <p className="text-sm text-zinc-600 font-medium mt-1">Collaborations</p>
          </div>
          <div className="bg-white rounded-xl border-2 border-zinc-900 p-6 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
            <p className="text-3xl font-gloria font-bold text-green-600">{hoursDisplay}</p>
            <p className="text-sm text-zinc-600 font-medium mt-1">Hours</p>
          </div>
        </motion.div>

        {/* Global Community Stats */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-8 bg-zinc-50 rounded-xl border-2 border-zinc-200 p-6 flex flex-col sm:flex-row items-center justify-between shadow-sm"
        >
          <div>
            <h3 className="text-lg font-bold text-zinc-900 mb-1 flex items-center gap-2">
              <Users size={20} className="text-indigo-600" />
              TeamSketch Community
            </h3>
            <p className="text-zinc-500 text-sm">Joined by {stats.totalUsers > 0 ? stats.totalUsers : '...'} registered users</p>
          </div>

          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            <div className="flex -space-x-3">
              {stats.sampleUsers.length > 0 ? (
                stats.sampleUsers.map((u, i) => (
                  <div
                    key={u._id || i}
                    className={`w-10 h-10 rounded-full border-2 border-zinc-50 flex items-center justify-center overflow-hidden text-sm font-bold shadow-sm ${['bg-indigo-500 text-white', 'bg-rose-500 text-white', 'bg-emerald-500 text-white', 'bg-amber-500 text-white', 'bg-purple-500 text-white'][i % 5]
                      }`}
                    title={u.username}
                  >
                    {u.username.substring(0, 2).toUpperCase()}
                  </div>
                ))
              ) : (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-zinc-50 bg-zinc-200 animate-pulse flex items-center justify-center overflow-hidden" />
                ))
              )}
            </div>
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 py-12 text-center text-zinc-400 font-medium">
        <p>&copy; {new Date().getFullYear()} TeamSketch. Built for thinkers and doers.</p>
      </footer>
    </div>
  );
};

export default UserProfile;
