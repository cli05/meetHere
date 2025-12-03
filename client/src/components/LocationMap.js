import React, { useState, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import './LocationMap.css';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Purdue campus center coordinates
const PURDUE_CENTER = {
  lat: 40.4274,
  lng: -86.9169,
};

const mapContainerStyle = {
  width: '100%',
  height: '400px',
  borderRadius: '8px',
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

const LocationMap = ({ onLocationSelect }) => {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [map, setMap] = useState(null);

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Purdue campus buildings
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

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const handleSelectLocation = (building) => {
    setSelectedLocation(building);
    if (onLocationSelect) {
      onLocationSelect(building);
    }
    // Pan map to selected building
    if (map) {
      map.panTo({ lat: building.lat, lng: building.lng });
      map.setZoom(18);
    }
  };

  const handleMarkerClick = (building) => {
    handleSelectLocation(building);
  };

  // Get user's current location
  const getCurrentLocation = () => {
    setIsLocating(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(userPos);
        setIsLocating(false);

        // Find nearest building
        const nearest = findNearestBuilding(userPos);
        if (nearest) {
          handleSelectLocation(nearest);
        }

        // Pan map to user location
        if (map) {
          map.panTo(userPos);
          map.setZoom(17);
        }
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError('Location permission denied. Please enable location access.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError('Location information unavailable.');
            break;
          case error.TIMEOUT:
            setLocationError('Location request timed out.');
            break;
          default:
            setLocationError('An unknown error occurred.');
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Find the nearest campus building to user's location
  const findNearestBuilding = (userPos) => {
    let nearest = null;
    let minDistance = Infinity;

    campusBuildings.forEach((building) => {
      const distance = getDistance(userPos, { lat: building.lat, lng: building.lng });
      if (distance < minDistance) {
        minDistance = distance;
        nearest = building;
      }
    });

    return nearest;
  };

  // Calculate distance between two points (Haversine formula)
  const getDistance = (pos1, pos2) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (pos1.lat * Math.PI) / 180;
    const φ2 = (pos2.lat * Math.PI) / 180;
    const Δφ = ((pos2.lat - pos1.lat) * Math.PI) / 180;
    const Δλ = ((pos2.lng - pos1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Render map or fallback
  const renderMap = () => {
    if (loadError) {
      return (
        <div className="map-placeholder">
          <div className="map-overlay">
            <div className="map-icon">⚠️</div>
            <h3>Map Loading Error</h3>
            <p className="map-note">
              Could not load Google Maps.<br />
              Please select your building from the list below.
            </p>
          </div>
        </div>
      );
    }

    if (!isLoaded) {
      return (
        <div className="map-placeholder">
          <div className="map-overlay">
            <div className="map-icon">🗺️</div>
            <h3>Loading Map...</h3>
          </div>
        </div>
      );
    }

    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'YOUR_API_KEY_HERE') {
      return (
        <div className="map-placeholder">
          <div className="map-overlay">
            <div className="map-icon">🔑</div>
            <h3>API Key Required</h3>
            <p className="map-note">
              Please add your Google Maps API key to the .env file.<br />
              Select your building from the list below.
            </p>
          </div>
        </div>
      );
    }

    return (
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : PURDUE_CENTER}
        zoom={16}
        options={mapOptions}
        onLoad={onMapLoad}
      >
        {/* Building markers */}
        {campusBuildings.map((building) => (
          <Marker
            key={building.id}
            position={{ lat: building.lat, lng: building.lng }}
            title={building.name}
            onClick={() => handleMarkerClick(building)}
            icon={
              selectedLocation?.id === building.id
                ? {
                    url: 'http://maps.google.com/mapfiles/ms/icons/gold-dot.png',
                  }
                : {
                    url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                  }
            }
          />
        ))}

        {/* User location marker */}
        {userLocation && (
          <Marker
            position={userLocation}
            title="Your Location"
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            }}
          />
        )}
      </GoogleMap>
    );
  };

  return (
    <div className="location-map-container">
      <div className="location-controls">
        <div className="location-search">
          <input
            type="text"
            placeholder="Search campus buildings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <button
          className="btn btn-location"
          onClick={getCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? '📍 Locating...' : '📍 Use My Location'}
        </button>
      </div>

      {locationError && (
        <div className="location-error">
          ⚠️ {locationError}
        </div>
      )}

      <div className="map-container">
        {renderMap()}
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
