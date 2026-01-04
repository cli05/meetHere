import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LandingPage.css';

const LandingPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [meetingCode, setMeetingCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);

  const handleLogout = () => {
    logout();
  };

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    if (meetingCode.trim()) {
      // Extract meeting ID from full URL or use as-is
      let meetingId = meetingCode.trim();
      if (meetingId.includes('/meeting/')) {
        meetingId = meetingId.split('/meeting/').pop();
      }
      if (meetingId.includes('/m/')) {
        meetingId = meetingId.split('/m/').pop();
      }
      navigate(`/meeting/${meetingId}`);
    }
  };

  const handleCreateMeeting = () => {
    if (user) {
      navigate('/create');
    } else {
      navigate('/signin', { state: { redirectTo: '/create' } });
    }
  };

  return (
    <div className="landing-page">
      {/* Floating Nav */}
      <nav className="floating-nav">
        <div className="nav-inner">
          <div className="nav-logo">
            <img src="/meetHere_logo_withText.png" alt="meetHere" className="logo-full" />
          </div>
          <div className="nav-actions">
            {user ? (
              <>
                <Link to="/dashboard" className="nav-link">Dashboard</Link>
                <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
              </>
            ) : (
              <>
                <Link to="/signin" className="nav-link">Sign In</Link>
                <Link to="/signup" className="nav-btn">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="hero-section">
        {/* Animated Background */}
        <div className="hero-bg">
          <div className="gradient-orb orb-1"></div>
          <div className="gradient-orb orb-2"></div>
          <div className="gradient-orb orb-3"></div>
          <div className="grid-pattern"></div>
        </div>

        <div className="hero-container">
          {/* Main Content */}
          <div className="hero-content">
            <h1 className="hero-title">
              <span className="title-line">Find the perfect</span>
              <span className="title-line gradient-text">time & place</span>
              <span className="title-line">to meet</span>
            </h1>
            
            <p className="hero-subtitle">
              No more endless group chats. Share a link, collect availability, 
              and let us find the optimal meeting spot for everyone.
            </p>

            {/* Action Cards */}
            <div className="action-cards">
              {/* Join Meeting Card */}
              <div className={`action-card join-card ${showJoinInput ? 'expanded' : ''}`}>
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                    <polyline points="10 17 15 12 10 7"/>
                    <line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                </div>
                
                {!showJoinInput ? (
                  <button 
                    className="card-button"
                    onClick={() => setShowJoinInput(true)}
                  >
                    <span className="button-text">Join Meeting</span>
                    <span className="button-subtext">Enter a meeting link or code</span>
                  </button>
                ) : (
                  <form onSubmit={handleJoinMeeting} className="join-form">
                    <input
                      type="text"
                      placeholder="Paste meeting link or code..."
                      value={meetingCode}
                      onChange={(e) => setMeetingCode(e.target.value)}
                      autoFocus
                      className="join-input"
                    />
                    <div className="join-actions">
                      <button 
                        type="button" 
                        className="btn-cancel"
                        onClick={() => {
                          setShowJoinInput(false);
                          setMeetingCode('');
                        }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn-join" disabled={!meetingCode.trim()}>
                        Join →
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Create Meeting Card */}
              <div className="action-card create-card">
                <div className="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                    <line x1="12" y1="14" x2="12" y2="18"/>
                    <line x1="10" y1="16" x2="14" y2="16"/>
                  </svg>
                </div>
                <button 
                  className="card-button"
                  onClick={handleCreateMeeting}
                >
                  <span className="button-text">Create Meeting</span>
                  <span className="button-subtext">Start scheduling in seconds</span>
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default LandingPage;
