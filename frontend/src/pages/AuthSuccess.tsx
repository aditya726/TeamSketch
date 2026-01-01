import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';

const AuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(({ data }) => {
         login({ ...data.data, token }); 
         navigate('/');
      })
      .catch(() => navigate('/login'));
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, login]);

  return <div className="flex justify-center items-center h-screen">Logging you in...</div>;
};

export default AuthSuccess;