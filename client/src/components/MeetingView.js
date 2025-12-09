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
  const [optimalLocations, setOptimalLocations] = useState([]);
  const [locationTab, setLocationTab] = useState('participants');
  const [selectedLocationDetail, setSelectedLocationDetail] = useState(null);
  
  // New state for edit functionality
  const [existingParticipant, setExistingParticipant] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [checkingName, setCheckingName] = useState(false);
  const [nameConfirmed, setNameConfirmed] = useState(false);

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
        
        // Fetch optimal locations if location services are enabled
        if (response.data.meeting.locationConstraint?.enabled) {
          fetchOptimalLocations();
        }
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

  const fetchOptimalLocations = async () => {
    try {
      const response = await axios.get(`/api/meetings/${id}/optimal-locations`);
      if (response.data.success) {
        setOptimalLocations(response.data.optimalLocations);
      }
    } catch (error) {
      console.error('Fetch optimal locations error:', error);
    }
  };

  // Check if participant already exists by name
  const checkExistingParticipant = async () => {
    if (!userName.trim() || !meeting) return;
    
    setCheckingName(true);
    setError('');
    
    try {
      const response = await axios.get(`/api/participants/check/${meeting._id}/${encodeURIComponent(userName.trim())}`);
      
      if (response.data.success && response.data.exists) {
        setExistingParticipant(response.data.participant);
        // Pre-fill the form with existing data
        const participant = response.data.participant;
        
        // Convert availability to the format used by AvailabilityGrid
        if (participant.availability && participant.availability.length > 0) {
          setUserAvailability(participant.availability);
        }
        
        // Set location if exists
        if (participant.location) {
          setUserLocation({
            name: participant.location.buildingName,
            abbr: participant.location.buildingAbbr,
            lat: participant.location.coordinates?.lat,
            lng: participant.location.coordinates?.lng
          });
        }
        
        setNameConfirmed(true);
      } else {
        setExistingParticipant(null);
        setNameConfirmed(true);
      }
    } catch (error) {
      console.error('Error checking participant:', error);
      setNameConfirmed(true);
    } finally {
      setCheckingName(false);
    }
  };

  // Handle name confirmation
  const handleConfirmName = () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    checkExistingParticipant();
  };

  // Reset to change name
  const handleChangeName = () => {
    setNameConfirmed(false);
    setExistingParticipant(null);
    setIsEditing(false);
    setUserAvailability([]);
    setUserLocation(null);
  };

  // Enter edit mode for existing participant
  const handleEditSubmission = () => {
    setIsEditing(true);
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

      const locationData = {
        buildingName: userLocation.name,
        buildingAbbr: userLocation.abbr,
        coordinates: {
          lat: userLocation.lat,
          lng: userLocation.lng
        }
      };

      let response;

      if (existingParticipant && isEditing) {
        // Update existing participant
        response = await axios.put(`/api/participants/${existingParticipant._id}`, {
          availability: userAvailability,
          location: locationData
        });
      } else {
        // Create new participant
        const participantData = {
          meetingId: meeting._id,
          name: userName.trim(),
          availability: userAvailability,
          location: locationData
        };
        response = await axios.post('/api/participants', participantData);
      }

      if (response.data.success) {
        // Trigger recalculation of optimal time/location
        await axios.put(`/api/meetings/${id}`);

        // Refresh meeting data to get updated results
        await fetchMeeting();

        setHasSubmitted(true);
        setIsEditing(false);
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

  // Helper to convert time index to time string
  const timeIndexToString = (timeIndex) => {
    if (!meeting.timeRange) return '';

    const [startHour, startMin] = meeting.timeRange.startTime.split(':').map(Number);

    // Calculate the time by adding 30-minute increments
    const totalMinutes = startHour * 60 + startMin + (timeIndex * 30);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Get optimal time display
  const getOptimalTimeDisplay = () => {
    if (!meeting.optimalTime || !meeting.availableDays) {
      return 'Calculating...';
    }

    const { slots, everyoneAvailable, message } = meeting.optimalTime;

    if (!slots || slots.length === 0) {
      return 'No optimal time found yet';
    }

    return (
      <>
        <div style={{ marginBottom: '12px', fontWeight: 'bold', color: everyoneAvailable ? '#4CAF50' : '#FFA726' }}>
          {everyoneAvailable ? '✅ Everyone Available!' : '⚠️ Best Options Available'}
        </div>
        <div style={{ fontSize: '14px', marginBottom: '12px', color: '#666' }}>
          {message}
        </div>
        {slots.map((slot, index) => {
          const date = meeting.availableDays[slot.dayIndex];
          const startTime = timeIndexToString(slot.startTimeIndex);
          const endTime = timeIndexToString(slot.endTimeIndex + 1); // +1 because endTimeIndex is inclusive

          return (
            <div key={index} style={{
              marginBottom: slots.length > 1 ? '8px' : '0',
              padding: '8px',
              background: everyoneAvailable ? '#E8F5E9' : '#FFF3E0',
              borderRadius: '6px',
              color: '#1a1a1a'
            }}>
              {formatDate(date)}<br />
              {formatTime(startTime)} - {formatTime(endTime)}
              <div className="result-detail" style={{ marginTop: '4px', fontSize: '12px', color: '#333' }}>
                {slot.participantCount} {slot.participantCount === 1 ? 'person' : 'people'}
              </div>
            </div>
          );
        })}
      </>
    );
  };

  // Get optimal location display
  const getOptimalLocationDisplay = () => {
    // If we have optimal locations from the algorithm, show the #1 location
    if (optimalLocations && optimalLocations.length > 0) {
      const topLocation = optimalLocations[0];
      return (
        <>
          🏛️ {topLocation.name}
          <div className="result-detail" style={{ marginTop: '8px' }}>
            {topLocation.abbr} • Avg distance: {(topLocation.avgDistance * 3.28084 / 5280).toFixed(2)} mi
          </div>
        </>
      );
    }

    // Fall back to calculated center point if no optimal locations yet
    if (!meeting.optimalLocation) {
      return 'Calculating...';
    }

    const { buildingName, buildingAbbr } = meeting.optimalLocation;
    return `🏛️ ${buildingName || buildingAbbr || 'Calculated Center Point'}`;
  };

  // Get all participant locations including creator
  const getAllParticipantLocations = () => {
    const locations = [];
    
    if (meeting.creatorLocation) {
      locations.push({
        name: 'Creator',
        ...meeting.creatorLocation
      });
    }
    
    meeting.participants?.forEach(p => {
      if (p.location) {
        locations.push({
          name: p.name,
          ...p.location
        });
      }
    });
    
    return locations;
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
            <img src="/meetHere_icon_trans.png" alt="meetHere" className="logo-icon" />
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
              {/* Step 1: Name Entry/Confirmation */}
              <div className="section">
                <h2 className="section-header">Your Information</h2>
                <div className="user-form">
                  <div className="form-group">
                    <label>Your Name *</label>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Enter your name"
                        value={userName}
                        onChange={(e) => {
                          setUserName(e.target.value);
                          if (nameConfirmed) {
                            // Reset if name changes after confirmation
                            setNameConfirmed(false);
                            setExistingParticipant(null);
                          }
                        }}
                        disabled={nameConfirmed}
                        style={{ flex: 1 }}
                      />
                      {!nameConfirmed ? (
                        <button
                          className="btn btn-primary"
                          onClick={handleConfirmName}
                          disabled={!userName.trim() || checkingName}
                        >
                          {checkingName ? 'Checking...' : 'Continue'}
                        </button>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          onClick={handleChangeName}
                        >
                          Change
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Show existing participant's submission */}
              {nameConfirmed && existingParticipant && !isEditing && (
                <div className="section">
                  <div className="existing-submission-card" style={{
                    background: '#f0f9ff',
                    border: '1px solid #0071e3',
                    borderRadius: '12px',
                    padding: '20px',
                    marginBottom: '20px'
                  }}>
                    <h3 style={{ marginTop: 0, color: '#0071e3' }}>
                      ✓ You've already submitted your availability!
                    </h3>
                    <div style={{ marginTop: '16px' }}>
                      <p><strong>Availability:</strong> {existingParticipant.availability?.length || 0} time slots selected</p>
                      <p><strong>Location:</strong> {existingParticipant.location?.buildingName || existingParticipant.location?.buildingAbbr || 'Not specified'}</p>
                    </div>
                    <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                      <button
                        className="btn btn-primary"
                        onClick={handleEditSubmission}
                      >
                        ✏️ Edit My Submission
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => setHasSubmitted(true)}
                      >
                        View Results
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Show form for new participants or editing existing ones */}
              {nameConfirmed && (!existingParticipant || isEditing) && (
                <>
                  {isEditing && (
                    <div style={{
                      background: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '8px',
                      padding: '12px',
                      marginBottom: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <span>✏️</span>
                      <span>You're editing your existing submission. Changes will replace your previous response.</span>
                    </div>
                  )}

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
                      initialSelection={existingParticipant?.availability || []}
                    />
                    {userAvailability.length > 0 && (
                      <p style={{ marginTop: '12px', color: 'var(--accent-blue)' }}>
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
                      initialLocation={userLocation}
                    />
                    {userLocation && (
                      <p style={{ marginTop: '12px', color: 'var(--accent-blue)' }}>
                        ✓ Location selected: {userLocation.name || `${userLocation.lat?.toFixed(4)}, ${userLocation.lng?.toFixed(4)}`}
                      </p>
                    )}
                  </div>

                  <div className="submit-section">
                    {isEditing && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setIsEditing(false);
                          // Reset to original values
                          if (existingParticipant) {
                            setUserAvailability(existingParticipant.availability || []);
                            if (existingParticipant.location) {
                              setUserLocation({
                                name: existingParticipant.location.buildingName,
                                abbr: existingParticipant.location.buildingAbbr,
                                lat: existingParticipant.location.coordinates?.lat,
                                lng: existingParticipant.location.coordinates?.lng
                              });
                            }
                          }
                        }}
                        style={{ marginRight: '10px' }}
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      className="btn btn-primary btn-large"
                      onClick={handleSubmit}
                      disabled={!userName.trim() || !userLocation || userAvailability.length === 0 || submitting}
                    >
                      {submitting ? 'Saving...' : (isEditing ? 'Update Availability' : 'Submit Availability')}
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="results-section">
              <div className="success-message">
                <div className="success-icon">✓</div>
                <h2>Thank you, {userName}!</h2>
                <p>{isEditing || existingParticipant ? 'Your availability has been updated.' : 'Your availability has been recorded.'}</p>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setHasSubmitted(false);
                    setIsEditing(true);
                  }}
                  style={{ marginTop: '16px' }}
                >
                  ✏️ Edit My Submission
                </button>
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

              {meeting.locationConstraint?.enabled && getAllParticipantLocations().length > 0 && (
                <div className="section">
                  <h2 className="section-header">Meeting Locations</h2>
                  
                  <div className="location-tabs">
                    <button 
                      className={`tab-button ${locationTab === 'participants' ? 'active' : ''}`}
                      onClick={() => setLocationTab('participants')}
                    >
                      Where Everyone Wants to Meet ({getAllParticipantLocations().length})
                    </button>
                    <button 
                      className={`tab-button ${locationTab === 'optimal' ? 'active' : ''}`}
                      onClick={() => setLocationTab('optimal')}
                    >
                      Ideal Locations ({optimalLocations.length})
                    </button>
                  </div>

                  <div className="tab-content">
                    {locationTab === 'participants' && (
                      <div className="participant-locations-list">
                        {getAllParticipantLocations().map((loc, index) => (
                          <div 
                            key={index} 
                            className="location-card clickable"
                            onClick={() => setSelectedLocationDetail(loc)}
                          >
                            <div className="location-icon">📍</div>
                            <div className="location-info">
                              <div className="location-name">{loc.buildingName || 'Selected Location'}</div>
                              <div className="location-abbr">{loc.buildingAbbr || `${loc.coordinates?.lat.toFixed(4)}, ${loc.coordinates?.lng.toFixed(4)}`}</div>
                              <div className="location-person">{loc.name}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {locationTab === 'optimal' && (
                      <div className="optimal-locations-list">
                        {optimalLocations.length > 0 ? (
                          optimalLocations.map((loc, index) => (
                            <div 
                              key={index} 
                              className="optimal-location-card clickable"
                              onClick={() => setSelectedLocationDetail({ ...loc, buildingName: loc.name, buildingAbbr: loc.abbr })}
                            >
                              <div className="optimal-rank">#{index + 1}</div>
                              <div className="optimal-info">
                                <div className="optimal-name">
                                  {loc.name}
                                  <span className="optimal-abbr">{loc.abbr}</span>
                                </div>
                                <div className="optimal-stats">
                                  <span className="stat">
                                    Avg: {(loc.avgDistance * 3.28084 / 5280).toFixed(2)} mi
                                  </span>
                                  <span className="stat">
                                    ~{Math.round(loc.avgDistance * 3.28084 / 5280 * 20)} min walk
                                  </span>
                                </div>
                                <div className="optimal-fairness">
                                  Fairness score: {loc.fairnessScore < 100 ? 'Excellent' : loc.fairnessScore < 200 ? 'Good' : 'Fair'}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="no-locations">
                            <p>Optimal locations will be calculated once more participants submit their locations.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedLocationDetail && (
                <div className="location-detail-modal" onClick={() => setSelectedLocationDetail(null)}>
                  <div className="location-detail-content" onClick={(e) => e.stopPropagation()}>
                    <button className="close-button" onClick={() => setSelectedLocationDetail(null)}>×</button>
                    <h3>📍 {selectedLocationDetail.buildingName || 'Selected Location'}</h3>
                    {selectedLocationDetail.buildingAbbr && (
                      <p className="location-abbr-detail">{selectedLocationDetail.buildingAbbr}</p>
                    )}
                    {selectedLocationDetail.name && (
                      <p className="location-person-detail">Selected by: {selectedLocationDetail.name}</p>
                    )}
                    {selectedLocationDetail.coordinates && (
                      <div className="location-coordinates">
                        <p><strong>Coordinates:</strong></p>
                        <p>Latitude: {selectedLocationDetail.coordinates.lat.toFixed(6)}</p>
                        <p>Longitude: {selectedLocationDetail.coordinates.lng.toFixed(6)}</p>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${selectedLocationDetail.coordinates.lat},${selectedLocationDetail.coordinates.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                        >
                          Open in Google Maps
                        </a>
                      </div>
                    )}
                    {selectedLocationDetail.avgDistance && (
                      <div className="location-stats-detail">
                        <p><strong>Average Distance:</strong> {(selectedLocationDetail.avgDistance * 3.28084 / 5280).toFixed(2)} miles</p>
                        <p><strong>Estimated Walk Time:</strong> ~{Math.round(selectedLocationDetail.avgDistance * 3.28084 / 5280 * 20)} minutes</p>
                        <p><strong>Fairness Score:</strong> {selectedLocationDetail.fairnessScore < 100 ? 'Excellent' : selectedLocationDetail.fairnessScore < 200 ? 'Good' : 'Fair'}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
