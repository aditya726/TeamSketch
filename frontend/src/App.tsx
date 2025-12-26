import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';

// Import Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthSuccess from './pages/AuthSuccess';
import Whiteboard from './components/Whiteboard';

// --- Protected Route Component ---
// This checks if the user is logged in. If not, it kicks them back to Login.
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Google Auth Callback Route */}
        <Route path="/auth-success" element={<AuthSuccess />} />

        {/* Whiteboard Route - Public access */}
        <Route path="/whiteboard" element={<Whiteboard />} />

        {/* Protected Dashboard Route */}
        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              {/* This is a Placeholder for your future Whiteboard Canvas */}
              <div className="min-h-screen bg-gray-100 p-8">
                <div className="max-w-7xl mx-auto">
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">Dashboard</h1>
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-gray-600">
                      You are securely logged in! This is where the TeamSketch Whiteboard will go.
                    </p>
                    <button 
                      onClick={() => useAuthStore.getState().logout()}
                      className="mt-4 px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                    >
                      Logout Test
                    </button>
                  </div>
                </div>
              </div>
            </PrivateRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;