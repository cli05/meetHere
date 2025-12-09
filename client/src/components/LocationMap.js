import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import './LocationMap.css';

const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Default map center (can be customized)
const DEFAULT_CENTER = {
  lat: 40.4274,
  lng: -86.9169,
};

const mapContainerStyle = {
  width: '100%',
  height: '500px',
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
      stylers: [{ visibility: 'on' }],
    },
  ],
};

const LocationMap = ({ onLocationSelect, initialLocation = null }) => {
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [userLocation, setUserLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [map, setMap] = useState(null);

  // Initialize with initialLocation if provided
  useEffect(() => {
    if (initialLocation) {
      setSelectedLocation(initialLocation);
    }
  }, [initialLocation]);

  // Load Google Maps
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  // Handle map click to drop a pin
  const handleMapClick = (event) => {
    const location = {
      lat: event.latLng.lat(),
      lng: event.latLng.lng(),
      name: 'Selected Location',
    };
    setSelectedLocation(location);
    if (onLocationSelect) {
      onLocationSelect(location);
    }
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
          name: 'My Location',
        };
        setUserLocation(userPos);
        setSelectedLocation(userPos);
        setIsLocating(false);

        if (onLocationSelect) {
          onLocationSelect(userPos);
        }

        // Pan map to user location
        if (map) {
          map.panTo({ lat: userPos.lat, lng: userPos.lng });
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

  // Render map or fallback
  const renderMap = () => {
    if (loadError) {
      return (
        <div className="map-placeholder">
          <div className="map-overlay">
            <div className="map-icon">⚠️</div>
            <h3>Map Loading Error</h3>
            <p className="map-note">
              Could not load Google Maps.
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
              Please add your Google Maps API key to the .env file.
            </p>
          </div>
        </div>
      );
    }

    return (
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={selectedLocation ? { lat: selectedLocation.lat, lng: selectedLocation.lng } : DEFAULT_CENTER}
        zoom={selectedLocation ? 17 : 15}
        options={mapOptions}
        onLoad={onMapLoad}
        onClick={handleMapClick}
      >
        {/* Selected location marker */}
        {selectedLocation && (
          <Marker
            position={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
            title={selectedLocation.name}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
            }}
          />
        )}

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
        <button
          className="btn btn-location"
          onClick={getCurrentLocation}
          disabled={isLocating}
        >
          {isLocating ? '📍 Locating...' : '📍 Use My Location'}
        </button>
        <p className="location-hint">Click anywhere on the map to drop a pin</p>
      </div>

      {locationError && (
        <div className="location-error">
          ⚠️ {locationError}
        </div>
      )}

      <div className="map-container">
        {renderMap()}
      </div>

      {selectedLocation && (
        <div className="selected-location-info">
          <strong>Selected Location:</strong> {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default LocationMap;
