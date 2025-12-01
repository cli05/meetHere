const express = require('express');
const router = express.Router();
const Participant = require('../models/Participant');
const Meeting = require('../models/Meeting');

// Add participant to a meeting
router.post('/', async (req, res) => {
  try {
    const { meetingId, name, availability, location } = req.body;

    // Verify meeting exists
    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return res.status(404).json({ success: false, error: 'Meeting not found' });
    }

    const participant = new Participant({
      meetingId,
      name,
      availability,
      location,
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

// Update participant availability
router.put('/:id', async (req, res) => {
  try {
    const { availability, location } = req.body;

    const participant = await Participant.findByIdAndUpdate(
      req.params.id,
      { availability, location },
      { new: true }
    );

    if (!participant) {
      return res.status(404).json({ success: false, error: 'Participant not found' });
    }

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
