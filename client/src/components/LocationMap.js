import React, { useState } from 'react';
import './LocationMap.css';

const LocationMap = ({ onLocationSelect }) => {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Mock Purdue campus buildings
  const campusBuildings = [
    { id: 1, name: 'Lawson Computer Science Building', abbr: 'LWSN', lat: 40.4283, lng: -86.9162 },
    { id: 2, name: 'Hicks Undergraduate Library', abbr: 'HICKS', lat: 40.4264, lng: -86.9214 },
    { id: 3, name: 'Wilmeth Active Learning Center', abbr: 'WALC', lat: 40.4279, lng: -86.9166 },
    { id: 4, name: 'Electrical Engineering Building', abbr: 'EE', lat: 40.4282, lng: -86.9169 },
    { id: 5, name: 'Mathematical Sciences Building', abbr: 'MATH', lat: 40.4271, lng: -86.9152 },
    { id: 6, name: 'Recitation Building', abbr: 'REC', lat: 40.4268, lng: -86.9203 },
    { id: 7, name: 'Haas Hall', abbr: 'HAAS', lat: 40.4254, lng: -86.9189 },
    { id: 8, name: 'Stanley Coulter Hall', abbr: 'SC', lat: 40.4255, lng: -86.9208 },
    { id: 9, name: 'Stewart Center', abbr: 'STEW', lat: 40.4265, lng: -86.9186 },
    { id: 10, name: 'Armstrong Hall', abbr: 'ARMS', lat: 40.4276, lng: -86.9194 },
  ];

  const filteredBuildings = searchQuery
    ? campusBuildings.filter(
        (building) =>
          building.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          building.abbr.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : campusBuildings;

  const handleSelectLocation = (building) => {
    setSelectedLocation(building);
    if (onLocationSelect) {
      onLocationSelect(building);
    }
  };

  return (
    <div className="location-map-container">
      <div className="location-search">
        <input
          type="text"
          placeholder="Search campus buildings..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="map-placeholder">
        <div className="map-overlay">
          <div className="map-icon">🗺️</div>
          <h3>Purdue Campus Map</h3>
          <p className="map-note">
            Google Maps integration will be added here.<br />
            For now, select your building from the list below.
          </p>
        </div>
      </div>

      <div className="buildings-list">
        <h4>Select Your Starting Location</h4>
        <div className="buildings-grid">
          {filteredBuildings.map((building) => (
            <div
              key={building.id}
              className={`building-card ${
                selectedLocation?.id === building.id ? 'selected' : ''
              }`}
              onClick={() => handleSelectLocation(building)}
            >
              <div className="building-abbr">{building.abbr}</div>
              <div className="building-name">{building.name}</div>
              {selectedLocation?.id === building.id && (
                <div className="selected-indicator">✓</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selectedLocation && (
        <div className="selected-location-info">
          <strong>Selected:</strong> {selectedLocation.name} ({selectedLocation.abbr})
        </div>
      )}
    </div>
  );
};

export default LocationMap;
