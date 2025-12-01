import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './MeetingView.css';
import AvailabilityGrid from './AvailabilityGrid';
import LocationMap from './LocationMap';

const MeetingView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [userName, setUserName] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  useEffect(() => {
    // Fetch meeting data
    // For MVP, using mock data
    setMeeting({
      id,
      name: 'CS 390 Study Group',
      description: 'Weekly study session for CS390WAP',
      participants: [
        { name: 'Alice', availability: 12, location: 'LWSN' },
        { name: 'Bob', availability: 10, location: 'HAAS' },
        { name: 'Charlie', availability: 15, location: 'WALC' },
      ],
    });
  }, [id]);

  const handleSubmit = () => {
    // Submit availability and location
    console.log('Submitting:', { userName, userLocation });
    setHasSubmitted(true);
  };

  if (!meeting) {
    return (
      <div className="meeting-view">
        <div className="loading">Loading meeting...</div>
      </div>
    );
  }

  return (
    <div className="meeting-view">
      <div className="meeting-header">
        <div className="container">
          <h1 className="creator-logo" onClick={() => navigate('/')}>
            <span className="logo-meet">meet</span>
            <span className="logo-here">Here</span>
          </h1>
        </div>
      </div>

      <div className="meeting-content">
        <div className="container">
          <div className="meeting-info-card">
            <h1>{meeting.name}</h1>
            {meeting.description && <p className="meeting-description">{meeting.description}</p>}
            <div className="meeting-meta">
              <span className="meta-item">
                👥 {meeting.participants.length} participants
              </span>
              <span className="meta-item">
                📋 Share: <code className="share-link">{window.location.href}</code>
              </span>
            </div>
          </div>

          {!hasSubmitted ? (
            <>
              <div className="section">
                <h2 className="section-header">Your Information</h2>
                <div className="user-form">
                  <div className="form-group">
                    <label>Your Name *</label>
                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="section">
                <h2 className="section-header">Mark Your Availability</h2>
                <AvailabilityGrid isCreator={false} />
              </div>

              <div className="section">
                <h2 className="section-header">Your Starting Location</h2>
                <LocationMap 
                  onLocationSelect={(location) => setUserLocation(location)}
                />
              </div>

              <div className="submit-section">
                <button
                  className="btn btn-primary btn-large"
                  onClick={handleSubmit}
                  disabled={!userName.trim() || !userLocation}
                >
                  Submit Availability
                </button>
              </div>
            </>
          ) : (
            <div className="results-section">
              <div className="success-message">
                <div className="success-icon">✓</div>
                <h2>Thank you, {userName}!</h2>
                <p>Your availability has been recorded.</p>
              </div>

              <div className="section">
                <h2 className="section-header">Current Results</h2>
                <div className="results-grid">
                  <div className="result-card">
                    <h3>Best Meeting Time</h3>
                    <div className="result-value">
                      Wednesday, Dec 4<br />
                      2:00 PM - 3:30 PM
                    </div>
                    <div className="result-detail">
                      {meeting.participants.length} of {meeting.participants.length} available
                    </div>
                  </div>

                  <div className="result-card">
                    <h3>Optimal Location</h3>
                    <div className="result-value">
                      🏛️ Lawson Computer Science Building
                    </div>
                    <div className="result-detail">
                      Average 5 min walk for all participants
                    </div>
                  </div>
                </div>
              </div>

              <div className="section">
                <h2 className="section-header">Participants</h2>
                <div className="participants-list">
                  {meeting.participants.map((participant, index) => (
                    <div key={index} className="participant-item">
                      <div className="participant-avatar">
                        {participant.name.charAt(0)}
                      </div>
                      <div className="participant-info">
                        <div className="participant-name">{participant.name}</div>
                        <div className="participant-details">
                          {participant.availability} slots available • From {participant.location}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingView;
