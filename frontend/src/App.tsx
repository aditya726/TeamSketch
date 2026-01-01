import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';

// Import Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AuthSuccess from './pages/AuthSuccess';
import UserProfile from './pages/UserProfile';
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

        {/* Protected Profile Route */}
        <Route 
          path="/profile" 
          element={
            <PrivateRoute>
              <UserProfile />
            </PrivateRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;