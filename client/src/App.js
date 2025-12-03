import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import LandingPage from './components/LandingPage';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import Dashboard from './components/Dashboard';
import MeetingCreator from './components/MeetingCreator';
import MeetingView from './components/MeetingView';
import LocationTest from './components/LocationTest';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route 
              path="/dashboard" 
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              } 
            />
            <Route 
              path="/create" 
              element={
                <PrivateRoute>
                  <MeetingCreator />
                </PrivateRoute>
              } 
            />
            <Route path="/meeting/:id" element={<MeetingView />} />
            <Route path="/test-location" element={<LocationTest />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
