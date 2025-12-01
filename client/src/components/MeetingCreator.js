import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './MeetingCreator.css';
import AvailabilityGrid from './AvailabilityGrid';

const MeetingCreator = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [meetingData, setMeetingData] = useState({
    name: '',
    description: '',
    dates: [],
    timeSlots: [],
  });

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    // API call to create meeting
    console.log('Creating meeting:', meetingData);
    // navigate(`/meeting/${newMeetingId}`);
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
              <span>Details</span>
            </div>
            <div className="progress-line"></div>
            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
              <div className="step-circle">2</div>
              <span>Availability</span>
            </div>
            <div className="progress-line"></div>
            <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>
              <div className="step-circle">3</div>
              <span>Locations</span>
            </div>
          </div>

          {step === 1 && (
            <div className="creator-step">
              <h2>Meeting Details</h2>
              <div className="form-group">
                <label>Meeting Name *</label>
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
                  rows={4}
                />
              </div>
              <div className="button-group">
                <button className="btn btn-secondary" onClick={() => navigate('/')}>
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={handleNext}
                  disabled={!meetingData.name.trim()}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="creator-step">
              <h2>Set Available Times</h2>
              <p className="step-description">
                Select the date range and times when this meeting could potentially happen.
                Participants will mark their availability within these options.
              </p>
              <AvailabilityGrid 
                isCreator={true}
                onUpdate={(data) => setMeetingData({ ...meetingData, ...data })}
              />
              <div className="button-group">
                <button className="btn btn-secondary" onClick={handleBack}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={handleNext}>
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="creator-step">
              <h2>Location Preferences</h2>
              <p className="step-description">
                Participants will indicate where they're coming from, and we'll calculate
                the most geographically fair campus building for everyone.
              </p>
              <div className="location-info">
                <div className="info-box">
                  <h3>📍 How it works</h3>
                  <ul>
                    <li>Participants mark their starting location on campus</li>
                    <li>Our algorithm calculates the optimal meeting point</li>
                    <li>Results show the fairest building for everyone</li>
                  </ul>
                </div>
              </div>
              <div className="button-group">
                <button className="btn btn-secondary" onClick={handleBack}>
                  Back
                </button>
                <button className="btn btn-primary" onClick={handleSubmit}>
                  Create Meeting
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
