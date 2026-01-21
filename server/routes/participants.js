const express = require('express');
const router = express.Router();
const Participant = require('../models/Participant');
const Meeting = require('../models/Meeting');
const { protect, optionalAuth } = require('../middleware/auth');
const { toGeoJSON, fromGeoJSON } = require('../utils/geoUtils');

// Helper function to convert participant location from GeoJSON to lat/lng for frontend
function formatParticipantResponse(participant) {
  const obj = participant.toObject ? participant.toObject() : { ...participant };
  
  if (obj.location?.location?.coordinates) {
    obj.location.coordinates = fromGeoJSON(obj.location.location);
  }
  
  return obj;
}

// Helper function to convert location from frontend to GeoJSON
function convertLocationToGeoJSON(location) {
  if (!location) return null;
  
  return {
    buildingName: location.buildingName,
    buildingAbbr: location.buildingAbbr,
    location: location.coordinates ? 
      toGeoJSON(location.coordinates.lat, location.coordinates.lng) : null,
  };
}

// Check if logged-in user has a participant entry for a meeting
router.get('/my-entry/:meetingId', protect, async (req, res) => {
  try {
    const { meetingId } = req.params;
    
    // Find participant by meeting ID and user ID
    const participant = await Participant.findOne({
      meetingId,
      userId: req.user._id
    });
    
    if (participant) {
      res.json({ success: true, exists: true, participant: formatParticipantResponse(participant) });
    } else {
      res.json({ success: true, exists: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check if participant exists by name for a meeting (for anonymous users)
router.get('/check/:meetingId/:name', async (req, res) => {
  try {
    const { meetingId, name } = req.params;
    
    // Find participant by meeting ID and name (case-insensitive)
    const participant = await Participant.findOne({
      meetingId,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });
    
    if (participant) {
      res.json({ success: true, exists: true, participant: formatParticipantResponse(participant) });
    } else {
      res.json({ success: true, exists: false });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add participant to a meeting
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { meetingId, name, availability, location, notes } = req.body;

    // Verify meeting exists
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    // If user is logged in, check if they already have an entry
    if (req.user) {
      const existingEntry = await Participant.findOne({
        meetingId,
        userId: req.user._id
      });
      
      if (existingEntry) {
        return res.status(400).json({ 
          success: false, 
          error: 'You have already submitted your availability for this meeting' 
        });
      }
    }

    // Convert location to GeoJSON format
    const geoLocation = convertLocationToGeoJSON(location);

    const participant = new Participant({
      meetingId,
      userId: req.user ? req.user._id : null,
      name: req.user ? req.user.name : name,
      availability,
      location: geoLocation,
      notes: notes || '',
    });

    await participant.save();

    // Add participant to meeting and invalidate location cache
    meeting.participants.push(participant._id);
    meeting.locationsParticipantCount = -1; // Force recalculation on next request
    await meeting.save();

    res.status(201).json({ success: true, participant: formatParticipantResponse(participant) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all participants for a meeting
router.get('/meeting/:meetingId', async (req, res) => {
  try {
    const participants = await Participant.find({ meetingId: req.params.meetingId });
    res.json({ success: true, participants: participants.map(formatParticipantResponse) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get specific participant
router.get('/:id', async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id);
    
    if (!participant) {
      return res.status(404).json({ success: false, error: 'Participant not found' });
    }

    res.json({ success: true, participant: formatParticipantResponse(participant) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update participant availability (requires auth for user-linked participants)
router.put('/:id', optionalAuth, async (req, res) => {
  try {
    const { availability, location, notes } = req.body;

    // First, find the participant to check ownership
    const existingParticipant = await Participant.findById(req.params.id);
    
    if (!existingParticipant) {
      return res.status(404).json({ success: false, error: 'Participant not found' });
    }

    // If participant is linked to a user, verify ownership
    if (existingParticipant.userId) {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
      }
      if (existingParticipant.userId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ success: false, error: 'You can only edit your own submission' });
      }
    }

    const updateData = {};
    if (availability !== undefined) updateData.availability = availability;
    if (location !== undefined) updateData.location = convertLocationToGeoJSON(location);
    if (notes !== undefined) updateData.notes = notes;
    updateData.updatedAt = Date.now();

    const participant = await Participant.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // If location was updated, invalidate the meeting's location cache
    if (location !== undefined) {
      await Meeting.findByIdAndUpdate(
        existingParticipant.meetingId,
        { $set: { locationsParticipantCount: -1 } }
      );
    }

    res.json({ success: true, participant: formatParticipantResponse(participant) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete participant
router.delete('/:id', async (req, res) => {
  try {
    const participant = await Participant.findById(req.params.id);
    
    if (!participant) {
      return res.status(404).json({ success: false, error: 'Participant not found' });
    }

    // Remove from meeting's participants array and invalidate location cache
    await Meeting.findByIdAndUpdate(
      participant.meetingId,
      { 
        $pull: { participants: participant._id },
        $set: { locationsParticipantCount: -1 }
      }
    );

    await Participant.deleteOne({ _id: req.params.id });

    res.json({ success: true, message: 'Participant deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
