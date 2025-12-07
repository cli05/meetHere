import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import './MeetingView.css';
import AvailabilityGrid from './AvailabilityGrid';
import LocationMap from './LocationMap';

const MeetingView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState(null);
  const [userName, setUserName] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [userAvailability, setUserAvailability] = useState([]);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [optimalLocations, setOptimalLocations] = useState([]);
  const [locationTab, setLocationTab] = useState('participants'); // 'participants' or 'optimal'
  const [selectedLocationDetail, setSelectedLocationDetail] = useState(null);

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  const fetchMeeting = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/api/meetings/${id}`);
      if (response.data.success) {
        setMeeting(response.data.meeting);
        
        // Fetch optimal locations if location services are enabled
        if (response.data.meeting.locationConstraint?.enabled) {
          fetchOptimalLocations();
        }
      }
    } catch (error) {
      console.error('Fetch meeting error:', error);
      setError('Failed to load meeting');
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

  const handleSubmit = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (meeting.locationConstraint?.enabled && !userLocation) {
      setError('Please select your starting location');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Convert availability from string format "dayIndex-timeIndex" to object format
      const formattedAvailability = userAvailability.map(slot => {
        const [dayIndex, timeIndex] = slot.split('-').map(Number);
        return { dayIndex, timeIndex };
      });
      
      const participantData = {
        meetingId: meeting._id,
        name: userName,
        availability: formattedAvailability,
        location: userLocation ? {
          buildingName: userLocation.name,
          buildingAbbr: userLocation.abbr,
          coordinates: {
            lat: userLocation.lat,
            lng: userLocation.lng,
          }
        } : null,
      };

      const response = await axios.post('/api/participants', participantData);
      
      if (response.data.success) {
        setHasSubmitted(true);
        // Refetch meeting data to update participants list
        await fetchMeeting();
      }
    } catch (error) {
      console.error('Submit error:', error);
      setError(error.response?.data?.error || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !meeting) {
    return (
      <div className="meeting-view">
        <div className="loading">Loading meeting...</div>
      </div>
    );
  }

  if (error && !meeting) {
    return (
      <div className="meeting-view">
        <div className="error">{error}</div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="meeting-view">
        <div className="error">Meeting not found</div>
      </div>
    );
  }

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

  const participantLocations = getAllParticipantLocations();

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
                {meeting.participants?.length || 0} participants
              </span>
              {meeting.locationConstraint?.enabled && (
                <span className="meta-item">
                  📍 Location services enabled
                </span>
              )}
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
                <AvailabilityGrid 
                  isCreator={false}
                  onUpdate={(data) => setUserAvailability(data.selectedSlots || [])}
                />
              </div>

              {meeting.locationConstraint?.enabled && (
                <div className="section">
                  <h2 className="section-header">Your Starting Location *</h2>
                  <p className="section-hint">
                    Select where you'll be coming from to help find the best meeting spot
                  </p>
                  <LocationMap 
                    onLocationSelect={(location) => setUserLocation(location)}
                  />
                </div>
              )}

              {error && <div className="error-message">{error}</div>}

              <div className="submit-section">
                <button
                  className="btn btn-primary btn-large"
                  onClick={handleSubmit}
                  disabled={loading || !userName.trim() || (meeting.locationConstraint?.enabled && !userLocation)}
                >
                  {loading ? 'Submitting...' : 'Submit Availability'}
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

              {meeting.locationConstraint?.enabled && participantLocations.length > 0 && (
                <div className="section">
                  <h2 className="section-header">Meeting Locations</h2>
                  
                  <div className="location-tabs">
                    <button 
                      className={`tab-button ${locationTab === 'participants' ? 'active' : ''}`}
                      onClick={() => setLocationTab('participants')}
                    >
                      Where Everyone Wants to Meet ({participantLocations.length})
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
                        {participantLocations.map((loc, index) => (
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
                <h2 className="section-header">Participants</h2>
                <div className="participants-list">
                  {meeting.participants && meeting.participants.length > 0 ? (
                    meeting.participants.map((participant, index) => (
                      <div key={index} className="participant-item">
                        <div className="participant-avatar">
                          {participant.name.charAt(0)}
                        </div>
                        <div className="participant-info">
                          <div className="participant-name">{participant.name}</div>
                          <div className="participant-details">
                            {participant.availability?.length || 0} slots available
                            {participant.location && ` • From ${participant.location.buildingAbbr || participant.location.buildingName || 'Custom location'}`}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-participants">No participants yet. Be the first!</div>
                  )}
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
