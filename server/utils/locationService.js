const axios = require('axios');

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_BASE_URL = 'https://places.googleapis.com/v1/places';

/**
 * Find nearby buildings using Google Places API (New)
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusMeters - Search radius in meters
 * @param {Array} includedTypes - Place types to include
 * @returns {Promise<Array>} Array of nearby places
 */
async function findNearbyBuildings(lat, lng, radiusMeters = 1000, includedTypes = null) {
  const defaultTypes = [
    'university',
    'library',
    'school',
    'secondary_school',
    'primary_school'
  ];

  const requestBody = {
    includedTypes: includedTypes || defaultTypes,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: radiusMeters
      }
    }
  };

  try {
    const response = await axios.post(
      `${GOOGLE_PLACES_BASE_URL}:searchNearby`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.shortFormattedAddress,places.types'
        }
      }
    );

    if (!response.data.places) {
      return [];
    }

    return response.data.places.map(place => ({
      id: place.id,
      name: place.displayName?.text || 'Unknown',
      abbr: null, // Google doesn't provide abbreviations
      lat: place.location?.latitude,
      lng: place.location?.longitude,
      address: place.shortFormattedAddress || '',
      types: place.types || []
    }));
  } catch (error) {
    console.error('Google Places API error:', error.response?.data || error.message);
    throw new Error('Failed to fetch nearby buildings');
  }
}

/**
 * Search for places by text query
 * @param {string} query - Search query
 * @param {number} lat - Bias latitude
 * @param {number} lng - Bias longitude
 * @returns {Promise<Array>} Array of matching places
 */
async function searchPlaces(query, lat, lng) {
  const requestBody = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 2000
      }
    },
    maxResultCount: 10
  };

  try {
    const response = await axios.post(
      `${GOOGLE_PLACES_BASE_URL}:searchText`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.shortFormattedAddress'
        }
      }
    );

    if (!response.data.places) {
      return [];
    }

    return response.data.places.map(place => ({
      id: place.id,
      name: place.displayName?.text || 'Unknown',
      lat: place.location?.latitude,
      lng: place.location?.longitude,
      address: place.shortFormattedAddress || ''
    }));
  } catch (error) {
    console.error('Google Places search error:', error.response?.data || error.message);
    throw new Error('Failed to search places');
  }
}

module.exports = { findNearbyBuildings, searchPlaces };
