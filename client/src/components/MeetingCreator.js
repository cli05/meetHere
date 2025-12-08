import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import './MeetingCreator.css';
import LocationMap from './LocationMap';

const MeetingCreator = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 11, 1)); // December 2025
  const [isDragging, setIsDragging] = useState(false);
  const [createdMeeting, setCreatedMeeting] = useState(null);
  
  const [meetingData, setMeetingData] = useState({
    name: '',
    description: '',
    availableDays: [],
    timeRange: {
      startTime: '09:00',
      endTime: '17:00',
    },
    timezone: 'America/New_York',
    locationConstraint: {
      enabled: false,
      center: { lat: 40.4237, lng: -86.9212 }, // Purdue default
      radius: 4,
      address: '',
    },
    creatorLocation: null, // Store creator's selected location
  });

  // Generate calendar days for the current month
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    // First day of the month and how many days in month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    // Get day of week for first day (0 = Sunday)
    const startDayOfWeek = firstDay.getDay();
    
    // Create array of day objects
    const days = [];
    
    // Add empty slots for days before month starts
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      // Only include dates that are today or in the future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date >= today) {
        days.push(date);
      } else {
        days.push(null); // Past dates are null
      }
    }
    
    return days;
  };

  const previousMonth = () => {
    const newMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    // Don't go before current month
    const today = new Date();
    const currentActualMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (newMonth >= currentActualMonth) {
      setCurrentMonth(newMonth);
    }
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const toggleDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const isSelected = meetingData.availableDays.includes(dateStr);
    
    const newDays = isSelected
      ? meetingData.availableDays.filter(d => d !== dateStr)
      : [...meetingData.availableDays, dateStr].sort();
    
    setMeetingData({ ...meetingData, availableDays: newDays });
  };

  const handleMouseDown = (date) => {
    if (!date) return;
    setIsDragging(true);
    toggleDate(date);
  };

  const handleMouseEnter = (date) => {
    if (!date || !isDragging) return;
    
    const dateStr = date.toISOString().split('T')[0];
    if (!meetingData.availableDays.includes(dateStr)) {
      setMeetingData({
        ...meetingData,
        availableDays: [...meetingData.availableDays, dateStr].sort()
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!meetingData.name.trim()) {
        setError('Please enter a meeting name');
        return;
      }
      if (meetingData.availableDays.length === 0) {
        setError('Please select at least one available day');
        return;
      }
    }
    setError('');
    if (step < 2) setStep(step + 1);
  };

  const handleBack = () => {
    setError('');
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/meetings', meetingData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.data.success) {
        setCreatedMeeting(response.data.meeting);
        setStep(3); // Show success page
      }
    } catch (error) {
      console.error('Create meeting error:', error);
      setError(error.response?.data?.error || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const url = `${window.location.origin}/meeting/${createdMeeting.shareLink}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  return (
    <div className="meeting-creator">
      <div className="creator-header">
        <div className="container">
          <h1 className="creator-logo" onClick={() => navigate('/')}>
            <span className="logo-meet">meet</span>
            <span className="logo-here">Here</span>
          </h1>
        </div>
      </div>

      <div className="creator-content">
        <div className="container">
          <div className="progress-bar">
            <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
              <div className="step-circle">1</div>
              <span>Event Details</span>
            </div>
            <div className="progress-line"></div>
            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
              <div className="step-circle">2</div>
              <span>Location (Optional)</span>
            </div>
          </div>

          {step === 1 && (
            <div className="creator-step">
              <h2>Event Details</h2>
              {error && <div className="error-message">{error}</div>}
              
              <div className="form-group">
                <label>Event Name *</label>
                <input
                  type="text"
                  placeholder="CS 390 Study Group"
                  value={meetingData.name}
                  onChange={(e) => setMeetingData({ ...meetingData, name: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <label>Description (Optional)</label>
                <textarea
                  placeholder="Add any additional details about the meeting..."
                  value={meetingData.description}
                  onChange={(e) => setMeetingData({ ...meetingData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label>Available Days *</label>
                <p className="field-hint">Click and drag to select multiple days</p>
                
                <div className="calendar-header">
                  <button 
                    type="button"
                    className="calendar-nav-btn"
                    onClick={previousMonth}
                  >
                    ‹
                  </button>
                  <h3 className="calendar-month">
                    {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button 
                    type="button"
                    className="calendar-nav-btn"
                    onClick={nextMonth}
                  >
                    ›
                  </button>
                </div>
                
                <div className="calendar-grid" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                  <div className="calendar-weekdays">
                    <div className="weekday">Sun</div>
                    <div className="weekday">Mon</div>
                    <div className="weekday">Tue</div>
                    <div className="weekday">Wed</div>
                    <div className="weekday">Thu</div>
                    <div className="weekday">Fri</div>
                    <div className="weekday">Sat</div>
                  </div>
                  <div className="calendar-days">
                    {getCalendarDays().map((date, index) => {
                      if (!date) {
                        return <div key={`empty-${index}`} className="calendar-day empty"></div>;
                      }
                      
                      const dateStr = date.toISOString().split('T')[0];
                      const isSelected = meetingData.availableDays.includes(dateStr);
                      
                      return (
                        <div
                          key={dateStr}
                          className={`calendar-day ${isSelected ? 'selected' : ''}`}
                          onMouseDown={() => handleMouseDown(date)}
                          onMouseEnter={() => handleMouseEnter(date)}
                        >
                          {date.getDate()}
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {meetingData.availableDays.length > 0 && (
                  <p className="selected-count">
                    {meetingData.availableDays.length} day{meetingData.availableDays.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Start Time *</label>
                  <input
                    type="time"
                    value={meetingData.timeRange.startTime}
                    onChange={(e) => setMeetingData({
                      ...meetingData,
                      timeRange: { ...meetingData.timeRange, startTime: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group">
                  <label>End Time *</label>
                  <input
                    type="time"
                    value={meetingData.timeRange.endTime}
                    onChange={(e) => setMeetingData({
                      ...meetingData,
                      timeRange: { ...meetingData.timeRange, endTime: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Timezone</label>
                <select
                  value={meetingData.timezone}
                  onChange={(e) => setMeetingData({ ...meetingData, timezone: e.target.value })}
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                </select>
              </div>
              
              <div className="button-group">
                <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleNext}>
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="creator-step">
              <h2>Location Preferences (Optional)</h2>
              <p className="step-description">
                Set your starting location to help find the best meeting spot for everyone.
              </p>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={meetingData.locationConstraint.enabled}
                    onChange={(e) => setMeetingData({
                      ...meetingData,
                      locationConstraint: {
                        ...meetingData.locationConstraint,
                        enabled: e.target.checked
                      }
                    })}
                  />
                  <span>Enable location-based meeting suggestions</span>
                </label>
              </div>

              {meetingData.locationConstraint.enabled && (
                <>
                  <div className="form-group">
                    <label>Your Starting Location</label>
                    <p className="field-hint">
                      Select where you'll be coming from. Participants will also select their locations.
                    </p>
                    <LocationMap 
                      onLocationSelect={(location) => setMeetingData({
                        ...meetingData,
                        creatorLocation: {
                          buildingName: location.name,
                          buildingAbbr: location.abbr,
                          coordinates: {
                            lat: location.lat,
                            lng: location.lng,
                          }
                        }
                      })}
                    />
                    {meetingData.creatorLocation && (
                      <div className="location-selected-badge">
                        ✓ Selected: {meetingData.creatorLocation.buildingName}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Search Radius (miles)</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={meetingData.locationConstraint.radius}
                      onChange={(e) => setMeetingData({
                        ...meetingData,
                        locationConstraint: {
                          ...meetingData.locationConstraint,
                          radius: parseInt(e.target.value)
                        }
                      })}
                    />
                    <p className="field-hint">
                      System will suggest locations within this radius
                    </p>
                  </div>

                  <div className="location-info">
                    <div className="info-box">
                      <h3>📍 How it works</h3>
                      <ul>
                        <li>You select where you're coming from</li>
                        <li>Participants select their starting locations</li>
                        <li>Algorithm finds optimal meeting spots</li>
                        <li>Results show fairest locations for everyone</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}
              
              <div className="button-group">
                <button className="btn btn-secondary" onClick={handleBack}>
                  Back
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleSubmit}
                  disabled={loading || (meetingData.locationConstraint.enabled && !meetingData.creatorLocation)}
                >
                  {loading ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && createdMeeting && (
            <div className="creator-step success-step">
              <div className="success-icon">✓</div>
              <h2>Meeting Created!</h2>
              <p className="success-message">
                Your meeting <strong>{createdMeeting.name}</strong> has been created successfully.
              </p>
              
              <div className="share-link-box">
                <label>Share this link with participants:</label>
                <div className="link-display">
                  <input
                    type="text"
                    value={`${window.location.origin}/meeting/${createdMeeting.shareLink}`}
                    readOnly
                  />
                  <button className="btn btn-primary" onClick={copyToClipboard}>
                    Copy Link
                  </button>
                </div>
              </div>

              <div className="meeting-details">
                <h3>Meeting Details</h3>
                <div className="detail-item">
                  <span className="detail-label">Available Days:</span>
                  <span className="detail-value">{createdMeeting.availableDays.length} days selected</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Time Range:</span>
                  <span className="detail-value">
                    {createdMeeting.timeRange.startTime} - {createdMeeting.timeRange.endTime} {createdMeeting.timezone.split('/')[1].replace('_', ' ')}
                  </span>
                </div>
                {createdMeeting.locationConstraint?.enabled && (
                  <div className="detail-item">
                    <span className="detail-label">Location:</span>
                    <span className="detail-value">
                      {createdMeeting.locationConstraint.radius} mile radius
                    </span>
                  </div>
                )}
              </div>
              
              <div className="button-group">
                <button className="btn btn-secondary" onClick={() => window.location.href = '/create'}>
                  Create Another
                </button>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                  View My Meetings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingCreator;
