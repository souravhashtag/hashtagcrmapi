const { Holiday } = require('../models/Holiday');
const EventLogger = require('./EventController');

// Create new holiday
exports.createHoliday = async (req, res) => {
  try {
    const holiday = new Holiday(req.body);
    const savedHoliday = await holiday.save();

    // Ensure YYYY-MM-DD format
    const toYMD = (d) => {
      const dt = d instanceof Date ? d : new Date(d);
      return dt.toISOString().split('T')[0];
    };

    const dateYMD = toYMD(savedHoliday.date);

    // Log event creation - improved error handling
    try {
      // Make sure all required fields are properly set
      const eventData = {
        event_date: dateYMD,
        event_description: `Holiday Created: ${savedHoliday.name}`,
        event_type: 'Holiday',
        userId: req.user?._id?.toString() || req.user?.id?.toString(), 
      };

      // Debug logging to see what we're sending
      console.log('🔍 Attempting to log event with data:', eventData);

      // Validate required fields before calling
      if (!eventData.event_description || !eventData.event_type || !eventData.userId) {
        throw new Error(`Missing required fields: ${Object.entries(eventData)
            .filter(([key, value]) => !value && ['event_description', 'event_type', 'userId'].includes(key))
            .map(([key]) => key)
            .join(', ')
          }`);
      }

      await EventLogger.logEvent(eventData);
      console.log('✅ Event logged successfully');

    } catch (logErr) {
      console.error('❌ Error logging event:', logErr.message);
      console.error('📋 Event data was:', {
        event_date: dateYMD,
        event_description: `Holiday Created: ${savedHoliday.name}`,
        event_type: 'Holiday',
        userId: req.user?._id?.toString() || req.user?.id?.toString(),
      });
    }

    res.status(201).json(savedHoliday);
  } catch (err) {
    console.error('❌ Error creating holiday:', err);
    res.status(400).json({ error: err.message });
  }
};


// Get all holidays
exports.getAllHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.status(200).json(holidays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get single holiday by ID
exports.getHolidayById = async (req, res) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ message: 'Holiday not found' });
    res.json(holiday);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update holiday
exports.updateHoliday = async (req, res) => {
  try {
    const updatedHoliday = await Holiday.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedHoliday) return res.status(404).json({ message: 'Holiday not found' });
    res.json(updatedHoliday);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete holiday
exports.deleteHoliday = async (req, res) => {
  try {
    const deleted = await Holiday.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Holiday not found' });
    res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
