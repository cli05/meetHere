/**
 * GeoJSON utility functions for coordinate handling
 * MongoDB uses GeoJSON format with [longitude, latitude] order
 */

/**
 * Convert lat/lng to GeoJSON Point
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Object} GeoJSON Point
 */
function toGeoJSON(lat, lng) {
  if (lat === undefined || lng === undefined || lat === null || lng === null) {
    return null;
  }
  return {
    type: 'Point',
    coordinates: [lng, lat], // GeoJSON uses [longitude, latitude]
  };
}

/**
 * Convert GeoJSON Point to lat/lng object
 * @param {Object} point - GeoJSON Point
 * @returns {Object|null} { lat, lng } or null if invalid
 */
function fromGeoJSON(point) {
  if (!point || !point.coordinates || point.coordinates.length < 2) {
    return null;
  }
  return {
    lat: point.coordinates[1],
    lng: point.coordinates[0],
  };
}

/**
 * Calculate distance between two points using Haversine formula
 * Accepts either GeoJSON Points or lat/lng objects
 * @param {Object} point1 - GeoJSON Point or { lat, lng }
 * @param {Object} point2 - GeoJSON Point or { lat, lng }
 * @returns {number} Distance in meters
 */
function calculateDistance(point1, point2) {
  let lat1, lng1, lat2, lng2;

  // Handle GeoJSON format
  if (point1.coordinates) {
    lng1 = point1.coordinates[0];
    lat1 = point1.coordinates[1];
  } else {
    lat1 = point1.lat;
    lng1 = point1.lng;
  }

  if (point2.coordinates) {
    lng2 = point2.coordinates[0];
    lat2 = point2.coordinates[1];
  } else {
    lat2 = point2.lat;
    lng2 = point2.lng;
  }

  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate geographic center from array of GeoJSON points
 * @param {Array} points - Array of GeoJSON Points
 * @returns {Object} GeoJSON Point representing the center
 */
function calculateCenter(points) {
  if (!points || points.length === 0) {
    return null;
  }

  let totalLat = 0;
  let totalLng = 0;

  points.forEach(point => {
    if (point.coordinates) {
      totalLng += point.coordinates[0];
      totalLat += point.coordinates[1];
    }
  });

  return {
    type: 'Point',
    coordinates: [
      totalLng / points.length,
      totalLat / points.length,
    ],
  };
}

module.exports = { toGeoJSON, fromGeoJSON, calculateDistance, calculateCenter };
