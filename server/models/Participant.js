const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  meetingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  availability: [{
    dayIndex: Number,
    timeIndex: Number,
  }],
  location: {
    buildingName: String,
    buildingAbbr: String,
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Participant', participantSchema);
