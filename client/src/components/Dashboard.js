import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from '../utils/axios';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMeetings();
  }, []);

  const fetchMeetings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/meetings/my-meetings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success) {
        setMeetings(response.data.meetings);
      }
    } catch (error) {
      console.error('Fetch meetings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const copyLink = (meeting) => {
    if (meeting.status === 'expired') {
      alert('Cannot share expired meeting link');
      return;
    }
    const url = `${window.location.origin}/meeting/${meeting.shareLink}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleDeleteMeeting = async (meeting) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${meeting.name}"?\n\n` +
      `This will permanently delete the meeting and all ${meeting.participants?.length || 0} participant responses.\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/meetings/${meeting.shareLink}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.data.success) {
        // Remove from local state
        setMeetings(meetings.filter(m => m._id !== meeting._id));
        alert('Meeting deleted successfully');
      }
    } catch (error) {
      console.error('Delete meeting error:', error);
      alert('Failed to delete meeting. Please try again.');
    }
  };

  return (
    <div className="dashboard">
      <nav className="dashboard-nav">
        <div className="container">
          <div className="nav-content">
            <h1 className="logo" onClick={() => navigate('/')}>
              <span className="logo-meet">meet</span>
              <span className="logo-here">Here</span>
            </h1>
            <div className="nav-actions">
              <span className="user-greeting">Hello, {user?.name}</span>
              <button className="btn btn-secondary" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="dashboard-content">
        <div className="container">
          <div className="dashboard-header">
            <h1>My Meetings</h1>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/create')}
            >
              + Create Meeting
            </button>
          </div>

          <div className="meetings-section">
            {loading ? (
              <div className="loading-state">
                <p>Loading meetings...</p>
              </div>
            ) : meetings.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h2>No meetings yet</h2>
                <p>Create your first meeting to get started</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => navigate('/create')}
                >
                  Create Meeting
                </button>
              </div>
            ) : (
              <div className="meetings-grid">
                {meetings.map((meeting) => (
                  <div key={meeting._id} className="meeting-card">
                    <div className="meeting-header">
                      <h3>{meeting.name}</h3>
                      <span className={`status-badge ${meeting.status}`}>
                        {meeting.status}
                      </span>
                    </div>
                    
                    {meeting.description && (
                      <p className="meeting-description">{meeting.description}</p>
                    )}
                    
                    <div className="meeting-info">
                      <div className="info-row">
                        <span className="info-label">📅 Days:</span>
                        <span className="info-value">
                          {meeting.availableDays.slice(0, 3).map(day => formatDate(day)).join(', ')}
                          {meeting.availableDays.length > 3 && ` +${meeting.availableDays.length - 3} more`}
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">⏰ Time:</span>
                        <span className="info-value">
                          {meeting.timeRange.startTime} - {meeting.timeRange.endTime}
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">👥 Participants:</span>
                        <span className="info-value">
                          {meeting.participants?.length || 0} joined
                        </span>
                      </div>
                      {meeting.optimalTime && meeting.availableDays?.[meeting.optimalTime.dayIndex] && (
                        <div className="info-row optimal-result">
                          <span className="info-label">⭐ Best Time:</span>
                          <span className="info-value">
                            {formatDate(meeting.availableDays[meeting.optimalTime.dayIndex])} ({meeting.optimalTime.participantCount} available)
                          </span>
                        </div>
                      )}
                      {meeting.optimalLocation && (
                        <div className="info-row optimal-result">
                          <span className="info-label">📍 Best Location:</span>
                          <span className="info-value">
                            {meeting.optimalLocation.buildingName || meeting.optimalLocation.buildingAbbr || 'Calculated Center'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="meeting-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => copyLink(meeting)}
                        disabled={meeting.status === 'expired'}
                        style={{
                          opacity: meeting.status === 'expired' ? 0.5 : 1,
                          cursor: meeting.status === 'expired' ? 'not-allowed' : 'pointer'
                        }}
                      >
                        📋 {meeting.status === 'expired' ? 'Expired' : 'Copy Link'}
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/meeting/${meeting.shareLink}`)}
                      >
                        View →
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleDeleteMeeting(meeting)}
                        style={{
                          background: '#ff4444',
                          color: 'white',
                          border: 'none'
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
