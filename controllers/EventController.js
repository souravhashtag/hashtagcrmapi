const Event = require('../models/Event');

class EventLogger {
  static async logEvent(eventData) {
    try {
      const {
        event_date,
        event_description,
        event_type,
        userId
      } = eventData;

      // Validate required fields
      if (!event_description || !event_type || !userId) {
        throw new Error('Missing required fields: event_description, event_type, and userId are required');
      }

      const event = new Event({
        event_date,
        event_description,
        event_type,
        userId
      });

      const savedEvent = await event.save();
      console.log(`📝 Event logged: ${event_type} for user ${userId}`);
      
      return {
        success: true,
        data: savedEvent
      };
    } catch (error) {
      console.error('❌ Error logging event:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

}

module.exports = EventLogger;