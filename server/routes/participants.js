const express = require('express');
const router = express.Router();
const Participant = require('../models/Participant');
const Meeting = require('../models/Meeting');
const { protect, optionalAuth } = require('../middleware/auth');

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
      res.json({ success: true, exists: true, participant });
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
      res.json({ success: true, exists: true, participant });
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

    const participant = new Participant({
      meetingId,
      userId: req.user ? req.user._id : null,
      name: req.user ? req.user.name : name,
      availability,
      location,
      notes: notes || '',
    });

    await participant.save();

    // Add participant to meeting
    meeting.participants.push(participant._id);
    await meeting.save();

    res.status(201).json({ success: true, participant });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all participants for a meeting
router.get('/meeting/:meetingId', async (req, res) => {
  try {
    const participants = await Participant.find({ meetingId: req.params.meetingId });
    res.json({ success: true, participants });
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

    res.json({ success: true, participant });
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
    if (location !== undefined) updateData.location = location;
    if (notes !== undefined) updateData.notes = notes;
    updateData.updatedAt = Date.now();

    const participant = await Participant.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    res.json({ success: true, participant });
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

    // Remove from meeting's participants array
    await Meeting.findByIdAndUpdate(
      participant.meetingId,
      { $pull: { participants: participant._id } }
    );

    await Participant.deleteOne({ _id: req.params.id });

    res.json({ success: true, message: 'Participant deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
