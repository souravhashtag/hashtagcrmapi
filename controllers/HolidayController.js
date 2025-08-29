const Event = require('../models/Event');
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
        event_type: 'Holiday',
        refId: savedHoliday._id,
        event_description: savedHoliday.name
      };

      // Debug logging to see what we're sending
      console.log('🔍 Attempting to log event with data:', eventData);

      // Validate required fields before calling
      if (!eventData.event_type) {
        throw new Error(`Missing required fields: ${Object.entries(eventData)
          .filter(([key, value]) => !value && ['event_type'].includes(key))
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
        event_type: 'Holiday'
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
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      search,
      type,
      includePast = false
    } = req.query;

    // Convert to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter = {};

    // Search filter - searches in name and description
    if (search && search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } }
      ];
    }

    // Type filter
    if (type && type !== 'all') {
      filter.type = type;
    }

    // Date filter - exclude past holidays unless explicitly requested
    if (!includePast || includePast === 'false') {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD format

      filter.date = { $gte: todayString };
    }

    // Get total count for pagination
    const totalItems = await Holiday.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNum);

    // Get holidays with filters, sorting, and pagination
    const holidays = await Holiday.find(filter)
      .sort({ date: 1, name: 1 }) // Sort by date first, then by name
      .skip(skip)
      .limit(limitNum)
      .lean(); // Use lean() for better performance when you don't need Mongoose document methods

    // Calculate pagination info
    const pagination = {
      currentPage: pageNum,
      totalPages,
      totalItems,
      hasNextPage: pageNum < totalPages,
      hasPrevPage: pageNum > 1,
      nextPage: pageNum < totalPages ? pageNum + 1 : null,
      prevPage: pageNum > 1 ? pageNum - 1 : null
    };

    // Response format that matches your frontend expectations
    res.status(200).json({
      success: true,
      data: holidays,
      pagination,
      filters: {
        search: search || null,
        type: type || 'all',
        includePast: includePast === 'true'
      }
    });

  } catch (err) {
    console.error('Error in getAllHolidays:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      message: 'Failed to fetch holidays'
    });
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
// Delete holiday
exports.deleteHoliday = async (req, res) => {
  try {
    const deleted = await Holiday.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Holiday not found' });
    }

    let deletedCount = 0;
    try {
      // deleted._id is already an ObjectId — don't wrap it or stringify it
      const result = await Event.deleteMany({ refId: deleted._id });
      deletedCount = result?.deletedCount || 0;
      console.log(`🗑 Deleted ${deletedCount} log(s) for holiday: ${deleted.name}`);
    } catch (logErr) {
      console.error('❌ Error deleting related logs:', logErr);
    }

    return res.json({
      message: 'Holiday deleted successfully',
      logs_deleted: deletedCount
    });
  } catch (err) {
    console.error('❌ Error deleting holiday:', err);
    return res.status(500).json({ error: err.message });
  }
};


