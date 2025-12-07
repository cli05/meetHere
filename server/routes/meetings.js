const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const Participant = require('../models/Participant');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Create a new meeting (Protected)
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, availableDays, timeRange, timezone, locationConstraint } = req.body;

    console.log('Creating meeting for user:', req.user._id);

    const meeting = new Meeting({
      name,
      description,
      availableDays,
      timeRange,
      timezone: timezone || 'America/New_York',
      locationConstraint: locationConstraint || { enabled: false },
      createdBy: req.user._id,
      // Optimal time and location will be calculated when participants join
    });

    await meeting.save();

    // Add meeting to user's meetings array
    await User.findByIdAndUpdate(req.user._id, {
      $push: { meetings: meeting._id }
    });

    console.log('Meeting created:', meeting.shareLink);

    res.status(201).json({ 
      success: true, 
      meeting,
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

    res.json({ success: true, count: meetings.length, meetings });
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

    res.json({ success: true, meeting });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all meetings (for admin/testing)
router.get('/', async (req, res) => {
  try {
    const meetings = await Meeting.find().populate('participants');
    res.json({ success: true, meetings });
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
    res.json({ success: true, meeting });
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

// Helper function to calculate optimal meeting time
function calculateOptimalTime(participants) {
  if (!participants || participants.length === 0) {
    return null;
  }

  // Count availability for each time slot
  const timeSlotCounts = {};
  
  participants.forEach(participant => {
    participant.availability.forEach(slot => {
      const key = `${slot.dayIndex}-${slot.timeIndex}`;
      timeSlotCounts[key] = (timeSlotCounts[key] || 0) + 1;
    });
  });

  // Find time slot with maximum participants
  let maxCount = 0;
  let bestSlot = null;

  for (const [key, count] of Object.entries(timeSlotCounts)) {
    if (count > maxCount) {
      maxCount = count;
      bestSlot = key;
    }
  }

  if (bestSlot) {
    const [dayIndex, timeIndex] = bestSlot.split('-').map(Number);
    return {
      dayIndex,
      timeIndex,
      participantCount: maxCount,
    };
  }

  return null;
}

// Helper function to calculate optimal location (geographic center)
function calculateOptimalLocation(participants) {
  if (!participants || participants.length === 0) {
    return null;
  }

  const locations = participants
    .filter(p => p.location && p.location.coordinates)
    .map(p => p.location.coordinates);

  if (locations.length === 0) {
    return null;
  }

  // Calculate geographic center
  const avgLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
  const avgLng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;

  // For MVP, return the center coordinates
  // In production, use Google Maps API to find nearest building
  return {
    coordinates: {
      lat: avgLat,
      lng: avgLng,
    },
    buildingName: 'Calculated Center Point',
    buildingAbbr: 'CENTER',
  };
}

module.exports = router;
