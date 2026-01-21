const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const Participant = require('../models/Participant');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { findNearbyBuildings } = require('../utils/locationService');
const { toGeoJSON, fromGeoJSON, calculateDistance } = require('../utils/geoUtils');

// Helper function to format meeting response (convert GeoJSON back to lat/lng for frontend)
function formatMeetingResponse(meeting) {
  const obj = meeting.toObject ? meeting.toObject() : { ...meeting };
  
  // Convert creatorLocation
  if (obj.creatorLocation?.location?.coordinates) {
    obj.creatorLocation.coordinates = fromGeoJSON(obj.creatorLocation.location);
    delete obj.creatorLocation.location;
  }
  
  // Convert locationConstraint center
  if (obj.locationConstraint?.center?.coordinates) {
    const coords = fromGeoJSON(obj.locationConstraint.center);
    obj.locationConstraint.center = coords;
  }
  
  // Convert optimalLocation
  if (obj.optimalLocation?.location?.coordinates) {
    obj.optimalLocation.coordinates = fromGeoJSON(obj.optimalLocation.location);
    delete obj.optimalLocation.location;
  }
  
  // Convert optimalLocations array
  if (obj.optimalLocations && Array.isArray(obj.optimalLocations)) {
    obj.optimalLocations = obj.optimalLocations.map(loc => {
      const result = { ...loc };
      if (loc.location?.coordinates) {
        const coords = fromGeoJSON(loc.location);
        result.lat = coords.lat;
        result.lng = coords.lng;
        delete result.location;
      }
      return result;
    });
  }
  
  // Convert populated participants' locations
  if (obj.participants && Array.isArray(obj.participants)) {
    obj.participants = obj.participants.map(p => {
      // Handle both populated objects and plain objects
      const participant = p.toObject ? p.toObject() : { ...p };
      
      // Convert participant location from GeoJSON to lat/lng
      if (participant.location?.location?.coordinates) {
        participant.location.coordinates = fromGeoJSON(participant.location.location);
        delete participant.location.location;
      }
      
      return participant;
    });
  }
  
  return obj;
}

// Create a new meeting (Protected)
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, availableDays, timeRange, timezone, locationConstraint, creatorLocation } = req.body;

    console.log('Creating meeting for user:', req.user._id);

    // Convert creatorLocation to GeoJSON format
    let geoCreatorLocation = null;
    if (creatorLocation && creatorLocation.coordinates) {
      geoCreatorLocation = {
        buildingName: creatorLocation.buildingName,
        buildingAbbr: creatorLocation.buildingAbbr,
        location: toGeoJSON(creatorLocation.coordinates.lat, creatorLocation.coordinates.lng),
      };
    }

    // Convert locationConstraint center to GeoJSON
    let geoLocationConstraint = { enabled: false };
    if (locationConstraint && locationConstraint.enabled) {
      geoLocationConstraint = {
        enabled: true,
        center: locationConstraint.center ? 
          toGeoJSON(locationConstraint.center.lat, locationConstraint.center.lng) : null,
        radius: (locationConstraint.radius || 4) * 1609.34, // Convert miles to meters
        address: locationConstraint.address,
      };
    }

    const meeting = new Meeting({
      name,
      description,
      availableDays,
      timeRange,
      timezone: timezone || 'America/New_York',
      locationConstraint: geoLocationConstraint,
      creatorLocation: geoCreatorLocation,
      createdBy: req.user._id,
    });

    await meeting.save();

    // Add meeting to user's meetings array
    await User.findByIdAndUpdate(req.user._id, {
      $push: { meetings: meeting._id }
    });

    console.log('Meeting created:', meeting.shareLink);

    res.status(201).json({ 
      success: true, 
      meeting: formatMeetingResponse(meeting),
      shareLink: meeting.shareLink,
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's meetings (Protected) - Must come before /:shareLink
router.get('/my-meetings', protect, async (req, res) => {
  try {
    const meetings = await Meeting.find({ createdBy: req.user._id })
      .populate('participants')
      .sort({ createdAt: -1 });

    // Check and update expiration status for all meetings
    await Promise.all(meetings.map(meeting => meeting.checkAndUpdateExpiration()));

    // Format all meetings for frontend
    const formattedMeetings = meetings.map(formatMeetingResponse);

    res.json({ success: true, count: formattedMeetings.length, meetings: formattedMeetings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get meeting by share link
router.get('/:shareLink', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ shareLink: req.params.shareLink })
      .populate('participants');

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Check and update expiration status
    await meeting.checkAndUpdateExpiration();

    // Block access to expired meetings for new participants
    if (meeting.status === 'expired') {
      return res.status(410).json({
        success: false,
        error: 'This meeting has expired',
        expired: true
      });
    }

    res.json({ success: true, meeting: formatMeetingResponse(meeting) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get optimal locations for a meeting (with caching)
router.get('/:shareLink/optimal-locations', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ shareLink: req.params.shareLink })
      .populate('participants');

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    const currentParticipantCount = meeting.participants.length;
    const hasCreatorLocation = !!(meeting.creatorLocation?.location?.coordinates);
    const totalLocations = currentParticipantCount + (hasCreatorLocation ? 1 : 0);

    // Check if we need to recalculate
    const needsRecalculation = 
      !meeting.optimalLocations || 
      meeting.optimalLocations.length === 0 ||
      meeting.locationsParticipantCount !== totalLocations;

    if (needsRecalculation) {
      console.log('Calculating optimal locations (cache miss)');
      
      const optimalLocations = await findOptimalLocations(meeting.participants, meeting);
      
      // Cache the results
      meeting.optimalLocations = optimalLocations;
      meeting.locationsCalculatedAt = new Date();
      meeting.locationsParticipantCount = totalLocations;
      await meeting.save();

      // Format response for frontend (convert GeoJSON to lat/lng)
      const formattedLocations = optimalLocations.map(loc => ({
        ...loc,
        lat: loc.location?.coordinates?.[1],
        lng: loc.location?.coordinates?.[0],
      }));

      return res.json({ success: true, optimalLocations: formattedLocations, cached: false });
    }

    console.log('Returning cached optimal locations');
    
    // Format cached response for frontend
    const formattedLocations = meeting.optimalLocations.map(loc => ({
      ...loc.toObject ? loc.toObject() : loc,
      lat: loc.location?.coordinates?.[1] || loc.lat,
      lng: loc.location?.coordinates?.[0] || loc.lng,
    }));
    
    res.json({ success: true, optimalLocations: formattedLocations, cached: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all meetings (for admin/testing)
router.get('/', async (req, res) => {
  try {
    const meetings = await Meeting.find().populate('participants');
    const formattedMeetings = meetings.map(formatMeetingResponse);
    res.json({ success: true, meetings: formattedMeetings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update meeting (recalculate optimal time/location)
router.put('/:shareLink', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ shareLink: req.params.shareLink })
      .populate('participants');

    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Calculate optimal time
    const optimalTime = calculateOptimalTime(meeting.participants);
    meeting.optimalTime = optimalTime;

    // Calculate optimal location
    const optimalLocation = calculateOptimalLocation(meeting.participants);
    meeting.optimalLocation = optimalLocation;

    await meeting.save();
    res.json({ success: true, meeting: formatMeetingResponse(meeting) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete meeting
router.delete('/:shareLink', async (req, res) => {
  try {
    const meeting = await Meeting.findOne({ shareLink: req.params.shareLink });
    
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // Delete all participants
    await Participant.deleteMany({ meetingId: meeting._id });
    
    // Delete meeting
    await Meeting.deleteOne({ _id: meeting._id });

    res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to group consecutive time slots on the same day
function groupConsecutiveSlots(slots) {
  if (slots.length === 0) return [];

  // Sort slots by dayIndex, then timeIndex
  const sortedSlots = [...slots].sort((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    return a.timeIndex - b.timeIndex;
  });

  const grouped = [];
  let currentGroup = {
    dayIndex: sortedSlots[0].dayIndex,
    startTimeIndex: sortedSlots[0].timeIndex,
    endTimeIndex: sortedSlots[0].timeIndex,
    participantCount: sortedSlots[0].participantCount,
    everyoneAvailable: sortedSlots[0].everyoneAvailable
  };

  for (let i = 1; i < sortedSlots.length; i++) {
    const slot = sortedSlots[i];

    // If same day and consecutive time slots, extend the current group
    if (slot.dayIndex === currentGroup.dayIndex &&
        slot.timeIndex === currentGroup.endTimeIndex + 1) {
      currentGroup.endTimeIndex = slot.timeIndex;
    } else {
      // Save current group and start a new one
      grouped.push({ ...currentGroup });
      currentGroup = {
        dayIndex: slot.dayIndex,
        startTimeIndex: slot.timeIndex,
        endTimeIndex: slot.timeIndex,
        participantCount: slot.participantCount,
        everyoneAvailable: slot.everyoneAvailable
      };
    }
  }

  // Add the last group
  grouped.push(currentGroup);

  return grouped;
}

// Helper function to calculate optimal meeting time
function calculateOptimalTime(participants) {
  if (!participants || participants.length === 0) {
    return null;
  }

  const totalParticipants = participants.length;

  // Count availability for each time slot
  const timeSlotCounts = {};

  participants.forEach(participant => {
    participant.availability.forEach(slot => {
      const key = `${slot.dayIndex}-${slot.timeIndex}`;
      timeSlotCounts[key] = (timeSlotCounts[key] || 0) + 1;
    });
  });

  // Find all slots where EVERYONE is available
  const perfectSlots = [];
  const bestAlternativeSlots = [];
  let maxCount = 0;

  for (const [key, count] of Object.entries(timeSlotCounts)) {
    if (count === totalParticipants) {
      // Everyone is available at this slot
      const [dayIndex, timeIndex] = key.split('-').map(Number);
      perfectSlots.push({
        dayIndex,
        timeIndex,
        participantCount: count,
        everyoneAvailable: true
      });
    } else {
      // Track the best alternative slots
      if (count > maxCount) {
        maxCount = count;
        bestAlternativeSlots.length = 0; // Clear previous best
        const [dayIndex, timeIndex] = key.split('-').map(Number);
        bestAlternativeSlots.push({
          dayIndex,
          timeIndex,
          participantCount: count,
          everyoneAvailable: false
        });
      } else if (count === maxCount) {
        const [dayIndex, timeIndex] = key.split('-').map(Number);
        bestAlternativeSlots.push({
          dayIndex,
          timeIndex,
          participantCount: count,
          everyoneAvailable: false
        });
      }
    }
  }

  // Group consecutive slots on the same day
  const groupedPerfectSlots = groupConsecutiveSlots(perfectSlots);
  const groupedBestAlternativeSlots = groupConsecutiveSlots(bestAlternativeSlots);

  // Return perfect slots if any exist, otherwise return best alternatives
  if (groupedPerfectSlots.length > 0) {
    return {
      slots: groupedPerfectSlots,
      everyoneAvailable: true,
      message: `${groupedPerfectSlots.length} time range${groupedPerfectSlots.length > 1 ? 's' : ''} where everyone is available`
    };
  } else if (groupedBestAlternativeSlots.length > 0) {
    return {
      slots: groupedBestAlternativeSlots,
      everyoneAvailable: false,
      message: `Best option: ${maxCount} out of ${totalParticipants} participants available`
    };
  }

  return null;
}

// Helper function to calculate optimal location (geographic center) - updated for GeoJSON
function calculateOptimalLocation(participants) {
  if (!participants || participants.length === 0) {
    return null;
  }

  const locations = participants
    .filter(p => p.location?.location?.coordinates)
    .map(p => p.location.location);

  if (locations.length === 0) {
    return null;
  }

  // Calculate geographic center using GeoJSON coordinates
  const avgLng = locations.reduce((sum, loc) => sum + loc.coordinates[0], 0) / locations.length;
  const avgLat = locations.reduce((sum, loc) => sum + loc.coordinates[1], 0) / locations.length;

  return {
    location: toGeoJSON(avgLat, avgLng),
    buildingName: 'Calculated Center Point',
    buildingAbbr: 'CENTER',
  };
}

// Helper function to find optimal meeting locations using Google Places API
async function findOptimalLocations(participants, meeting) {
  // Get all participant locations (including creator if they set one)
  const participantLocations = [];
  
  // Add creator location if exists (now in GeoJSON format)
  if (meeting.creatorLocation?.location?.coordinates) {
    participantLocations.push(meeting.creatorLocation.location);
  }
  
  // Add participant locations (now in GeoJSON format)
  participants.forEach(p => {
    if (p.location?.location?.coordinates) {
      participantLocations.push(p.location.location);
    }
  });

  console.log('Participant locations (GeoJSON):', JSON.stringify(participantLocations, null, 2));

  if (participantLocations.length === 0) {
    return [];
  }

  // Calculate geographic center using GeoJSON coordinates
  const centerLng = participantLocations.reduce((sum, loc) => sum + loc.coordinates[0], 0) / participantLocations.length;
  const centerLat = participantLocations.reduce((sum, loc) => sum + loc.coordinates[1], 0) / participantLocations.length;

  console.log('Geographic center:', { lat: centerLat, lng: centerLng });

  // Fetch nearby buildings from Google Places API
  let buildings;
  try {
    buildings = await findNearbyBuildings(centerLat, centerLng, 1500);
    console.log(`Found ${buildings.length} buildings from Google Places API`);
  } catch (error) {
    console.error('Failed to fetch buildings from API:', error.message);
    return [];
  }

  if (buildings.length === 0) {
    console.log('No buildings found near the center point');
    return [];
  }

  // Calculate total distance from each building to all participants
  const buildingScores = buildings.map(building => {
    const buildingPoint = toGeoJSON(building.lat, building.lng);
    let totalDistance = 0;
    let maxDistance = 0;
    
    participantLocations.forEach(location => {
      const distance = calculateDistance(buildingPoint, location);
      totalDistance += distance;
      maxDistance = Math.max(maxDistance, distance);
    });

    const avgDistance = totalDistance / participantLocations.length;

    return {
      id: building.id,
      name: building.name,
      abbr: building.abbr,
      location: buildingPoint, // Store as GeoJSON
      address: building.address,
      types: building.types,
      avgDistance: Math.round(avgDistance), // meters
      maxDistance: Math.round(maxDistance), // meters
      totalDistance: Math.round(totalDistance),
      fairnessScore: Math.round(maxDistance - avgDistance), // Lower is more fair
    };
  });

  console.log('First 3 building scores:', JSON.stringify(buildingScores.slice(0, 3), null, 2));

  // Sort by average distance (best locations first)
  buildingScores.sort((a, b) => a.avgDistance - b.avgDistance);

  // Return top 5 locations
  return buildingScores.slice(0, 5);
}

module.exports = router;
