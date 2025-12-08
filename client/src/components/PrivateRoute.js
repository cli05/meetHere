import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        color: 'var(--purdue-gold)'
      }}>
        Loading...
      </div>
    );
  }

  return user ? children : <Navigate to="/signin" />;
};

export default PrivateRoute;
