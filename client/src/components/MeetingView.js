import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import './MeetingView.css';
import AvailabilityGrid from './AvailabilityGrid';
import LocationMap from './LocationMap';

const MeetingView = () => {
  const { id } = useParams(); // This is the shareLink
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [userName, setUserName] = useState('');
  const [userAvailability, setUserAvailability] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch real meeting data on mount
  useEffect(() => {
    fetchMeeting();
  }, [id]);

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get(`/api/meetings/${id}`);

      if (response.data.success) {
        setMeeting(response.data.meeting);
      } else {
        setError('Meeting not found');
      }
    } catch (err) {
      console.error('Error fetching meeting:', err);

      // Handle expired meeting (HTTP 410)
      if (err.response && err.response.status === 410) {
        setError('This meeting has expired and is no longer accepting responses.');
      } else if (err.response && err.response.data && err.response.data.error) {
        setError(err.response.data.error);
      } else {
        setError('Failed to load meeting. Please check the link and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAvailabilityUpdate = (data) => {
    // Convert selectedSlots array to availability format
    const availability = data.selectedSlots.map(slot => {
      const [dayIndex, timeIndex] = slot.split('-').map(Number);
      return { dayIndex, timeIndex };
    });
    setUserAvailability(availability);
  };

  const handleSubmit = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (userAvailability.length === 0) {
      setError('Please select at least one time slot');
      return;
    }

    if (!userLocation) {
      setError('Please select your location');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Submit participant data
      const participantData = {
        meetingId: meeting._id,
        name: userName.trim(),
        availability: userAvailability,
        location: {
          buildingName: userLocation.name,
          buildingAbbr: userLocation.abbr,
          coordinates: {
            lat: userLocation.lat,
            lng: userLocation.lng
          }
        }
      };

      const response = await axios.post('/api/participants', participantData);

      if (response.data.success) {
        // Trigger recalculation of optimal time/location
        await axios.put(`/api/meetings/${id}`);

        // Refresh meeting data to get updated results
        await fetchMeeting();

        setHasSubmitted(true);
      }
    } catch (err) {
      console.error('Error submitting availability:', err);
      setError('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  };

  // Format time helper
  const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Get optimal time display
  const getOptimalTimeDisplay = () => {
    if (!meeting.optimalTime || !meeting.availableDays) {
      return 'Calculating...';
    }

    const { dayIndex, participantCount } = meeting.optimalTime;
    const date = meeting.availableDays[dayIndex];

    if (!date) {
      return 'No optimal time found yet';
    }

    return (
      <>
        {formatDate(date)}<br />
        {formatTime(meeting.timeRange.startTime)} - {formatTime(meeting.timeRange.endTime)}
        <div className="result-detail" style={{ marginTop: '8px' }}>
          {participantCount} {participantCount === 1 ? 'person' : 'people'} available
        </div>
      </>
    );
  };

  // Get optimal location display
  const getOptimalLocationDisplay = () => {
    if (!meeting.optimalLocation) {
      return 'Calculating...';
    }

    const { buildingName, buildingAbbr } = meeting.optimalLocation;
    return `🏛️ ${buildingName || buildingAbbr || 'Calculated Center Point'}`;
  };

  if (loading) {
    return (
      <div className="meeting-view">
        <div className="loading">Loading meeting...</div>
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div className="meeting-view">
        <div className="meeting-content">
          <div className="container">
            <div className="error-message">
              <h2>❌ {error}</h2>
              <button className="btn btn-primary" onClick={() => navigate('/')}>
                Go Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="meeting-view">
        <div className="loading">Meeting not found</div>
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
                👥 {meeting.participants?.length || 0} participants
              </span>
              <span className="meta-item">
                📅 {meeting.availableDays?.length || 0} days available
              </span>
              <span className="meta-item">
                ⏰ {formatTime(meeting.timeRange.startTime)} - {formatTime(meeting.timeRange.endTime)}
              </span>
            </div>
          </div>

          {error && (
            <div className="error-banner" style={{
              padding: '12px',
              background: '#ff4444',
              color: 'white',
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

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
                <p style={{ marginBottom: '16px', color: '#666' }}>
                  Select the times when you're available to meet
                </p>
                <AvailabilityGrid
                  isCreator={false}
                  availableDays={meeting.availableDays}
                  timeRange={meeting.timeRange}
                  onUpdate={handleAvailabilityUpdate}
                />
                {userAvailability.length > 0 && (
                  <p style={{ marginTop: '12px', color: '#CEB888' }}>
                    ✓ {userAvailability.length} time slots selected
                  </p>
                )}
              </div>

              <div className="section">
                <h2 className="section-header">Your Starting Location</h2>
                <p style={{ marginBottom: '16px', color: '#666' }}>
                  Where will you be coming from?
                </p>
                <LocationMap
                  onLocationSelect={(location) => setUserLocation(location)}
                />
              </div>

              <div className="submit-section">
                <button
                  className="btn btn-primary btn-large"
                  onClick={handleSubmit}
                  disabled={!userName.trim() || !userLocation || userAvailability.length === 0 || submitting}
                >
                  {submitting ? 'Submitting...' : 'Submit Availability'}
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
                      {getOptimalTimeDisplay()}
                    </div>
                  </div>

                  <div className="result-card">
                    <h3>Optimal Location</h3>
                    <div className="result-value">
                      {getOptimalLocationDisplay()}
                    </div>
                    <div className="result-detail">
                      Most central location for all participants
                    </div>
                  </div>
                </div>
              </div>

              <div className="section">
                <h2 className="section-header">Participants ({meeting.participants?.length || 0})</h2>
                <div className="participants-list">
                  {meeting.participants && meeting.participants.length > 0 ? (
                    meeting.participants.map((participant, index) => (
                      <div key={participant._id || index} className="participant-item">
                        <div className="participant-avatar">
                          {participant.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="participant-info">
                          <div className="participant-name">{participant.name}</div>
                          <div className="participant-details">
                            {participant.availability?.length || 0} slots available
                            {participant.location?.buildingAbbr && ` • From ${participant.location.buildingAbbr}`}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#666' }}>No participants yet</p>
                  )}
                </div>
              </div>

              <div className="section">
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Share link copied to clipboard!');
                  }}
                >
                  📋 Copy Share Link
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingView;
