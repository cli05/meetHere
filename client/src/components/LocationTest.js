import React, { useState } from 'react';
import LocationMap from './LocationMap';

/**
 * Test component for verifying location services
 * Access this at /test-location route
 */
const LocationTest = () => {
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [geolocationResult, setGeolocationResult] = useState(null);
  const [geolocationError, setGeolocationError] = useState(null);
  const [isTestingGeolocation, setIsTestingGeolocation] = useState(false);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    console.log('Selected location:', location);
  };

  const testGeolocation = () => {
    setIsTestingGeolocation(true);
    setGeolocationError(null);
    setGeolocationResult(null);

    if (!navigator.geolocation) {
      setGeolocationError('Geolocation is not supported by your browser');
      setIsTestingGeolocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const result = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date(position.timestamp).toLocaleString(),
        };
        setGeolocationResult(result);
        setIsTestingGeolocation(false);
        console.log('Geolocation result:', result);
      },
      (error) => {
        let errorMessage;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Permission denied - please allow location access in your browser';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Position unavailable - location info could not be determined';
            break;
          case error.TIMEOUT:
            errorMessage = 'Request timed out';
            break;
          default:
            errorMessage = `Unknown error: ${error.message}`;
        }
        setGeolocationError(errorMessage);
        setIsTestingGeolocation(false);
        console.error('Geolocation error:', errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const testGoogleMapsApi = () => {
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    console.log('Google Maps API Key configured:', apiKey ? 'Yes (key exists)' : 'No');
    console.log('API Key value:', apiKey || 'NOT SET');
    alert(apiKey 
      ? `Google Maps API Key is configured: ${apiKey.substring(0, 10)}...` 
      : 'Google Maps API Key is NOT configured. Add REACT_APP_GOOGLE_MAPS_API_KEY to your .env file'
    );
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>🧪 Location Services Test Page</h1>
      <p>Use this page to verify that location services are working correctly.</p>

      <hr style={{ margin: '20px 0' }} />

      {/* Test 1: Browser Geolocation */}
      <section style={{ marginBottom: '30px' }}>
        <h2>Test 1: Browser Geolocation API</h2>
        <button 
          onClick={testGeolocation}
          disabled={isTestingGeolocation}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: isTestingGeolocation ? 'wait' : 'pointer',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
          }}
        >
          {isTestingGeolocation ? '📍 Getting Location...' : '📍 Test Browser Geolocation'}
        </button>

        {geolocationResult && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            backgroundColor: '#e8f5e9', 
            borderRadius: '8px',
            border: '1px solid #4CAF50'
          }}>
            <h3 style={{ color: '#2e7d32', margin: '0 0 10px 0' }}>✅ Geolocation Success!</h3>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li><strong>Latitude:</strong> {geolocationResult.latitude}</li>
              <li><strong>Longitude:</strong> {geolocationResult.longitude}</li>
              <li><strong>Accuracy:</strong> {geolocationResult.accuracy.toFixed(2)} meters</li>
              <li><strong>Timestamp:</strong> {geolocationResult.timestamp}</li>
            </ul>
          </div>
        )}

        {geolocationError && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            backgroundColor: '#ffebee', 
            borderRadius: '8px',
            border: '1px solid #f44336'
          }}>
            <h3 style={{ color: '#c62828', margin: '0 0 10px 0' }}>❌ Geolocation Error</h3>
            <p style={{ margin: 0 }}>{geolocationError}</p>
          </div>
        )}
      </section>

      <hr style={{ margin: '20px 0' }} />

      {/* Test 2: Google Maps API */}
      <section style={{ marginBottom: '30px' }}>
        <h2>Test 2: Google Maps API Key</h2>
        <button 
          onClick={testGoogleMapsApi}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            cursor: 'pointer',
            backgroundColor: '#2196F3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
          }}
        >
          🔑 Check Google Maps API Key
        </button>
        <p style={{ marginTop: '10px', color: '#666' }}>
          This will check if your .env file has REACT_APP_GOOGLE_MAPS_API_KEY configured.
        </p>
      </section>

      <hr style={{ margin: '20px 0' }} />

      {/* Test 3: LocationMap Component */}
      <section style={{ marginBottom: '30px' }}>
        <h2>Test 3: LocationMap Component</h2>
        <p>This tests the full LocationMap component with Google Maps integration:</p>
        
        <div style={{ 
          border: '2px solid #ddd', 
          borderRadius: '8px', 
          padding: '20px',
          marginTop: '15px'
        }}>
          <LocationMap onLocationSelect={handleLocationSelect} />
        </div>

        {selectedLocation && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            backgroundColor: '#e3f2fd', 
            borderRadius: '8px',
            border: '1px solid #2196F3'
          }}>
            <h3 style={{ color: '#1565c0', margin: '0 0 10px 0' }}>📍 Location Selected via Component</h3>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(selectedLocation, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <hr style={{ margin: '20px 0' }} />

      {/* Instructions */}
      <section style={{ backgroundColor: '#fff3e0', padding: '20px', borderRadius: '8px' }}>
        <h2>📋 Troubleshooting Guide</h2>
        <h3>If Geolocation fails:</h3>
        <ul>
          <li>Make sure you're on HTTPS or localhost</li>
          <li>Check that location permissions are enabled in your browser</li>
          <li>Try resetting location permissions for this site</li>
        </ul>
        
        <h3>If Google Maps doesn't load:</h3>
        <ul>
          <li>Add <code>REACT_APP_GOOGLE_MAPS_API_KEY=your-api-key</code> to <code>client/.env</code></li>
          <li>Make sure the API key has Maps JavaScript API enabled</li>
          <li>Restart the dev server after adding the key</li>
        </ul>
      </section>
    </div>
  );
};

export default LocationTest;
