const express = require('express');
const router = express.Router();
const { findNearbyBuildings, searchPlaces } = require('../utils/locationService');

// Search places by query
router.get('/search', async (req, res) => {
  try {
    const { query, lat, lng } = req.query;
    
    if (!query || !lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: query, lat, lng' 
      });
    }

    const places = await searchPlaces(query, parseFloat(lat), parseFloat(lng));
    res.json({ success: true, places });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get nearby buildings
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: lat, lng' 
      });
    }

    const buildings = await findNearbyBuildings(
      parseFloat(lat), 
      parseFloat(lng), 
      parseInt(radius) || 1000
    );
    res.json({ success: true, buildings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
