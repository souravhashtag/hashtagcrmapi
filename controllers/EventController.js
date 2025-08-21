const Event = require('../models/Event');

class EventLogger {
  static async logEvent(eventData) {
    try {
      const {
        event_date,
        event_description,
        event_type,
        userId,
        refId
      } = eventData;

      // Validate required fields
      if (!event_type) {
        throw new Error('Missing required fields: event_type are required');
      }

      const event = new Event({
        event_date,
        event_description,
        event_type,
        ...(userId && { userId }),
        ...(refId && { refId })
      });

      const savedEvent = await event.save();
      // console.log(`📝 Event logged: ${event_type} for user ${userId}`);

      return {
        success: true,
        data: savedEvent
      };
    } catch (error) {
      console.error('Error logging event:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  static async generateEventsFromDatabase(userId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const events = await Event.find({
        $or: [
          { userId: userId },
          { userId: null }
        ],
        event_date: {
          $gte: startDate,
          $lt: new Date(year, month, 1)
        }
      }).sort({ event_date: 1 });

      const eventsMap = {};
      const daysInMonth = endDate.getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        eventsMap[day] = { type: '', label: '' };
      }

      events.forEach(event => {
        const day = event.event_date.getDate();

        if (eventsMap[day].label === '') {
          eventsMap[day].label = event.event_description;
          eventsMap[day].type = event.event_type;
          eventsMap[day].emoji = (event?.event_type=='Holiday' ? '😊' : "");
        } else {
          eventsMap[day].label += ', ' + event.event_description;
        }
      });

      return eventsMap;

    } catch (error) {
      console.error('Error generating events from database:', error);
      throw error;
    }
  }

  static async generateEventsFromDatabaseAggregated(userId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const aggregatedEvents = await Event.aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            event_date: {
              $gte: startDate,
              $lt: new Date(year, month, 1)
            }
          }
        },
        {
          $group: {
            _id: { $dayOfMonth: '$event_date' },
            descriptions: { $push: '$event_description' },
            types: { $push: '$event_type' },
            firstType: { $first: '$event_type' }
          }
        }
      ]);

      const eventsMap = {};
      const daysInMonth = endDate.getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        eventsMap[day] = { type: '', label: '' };
      }

      aggregatedEvents.forEach(item => {
        const day = item._id;
        eventsMap[day] = {
          type: item.firstType,
          label: item.descriptions.join(', ')
        };
      });

      return eventsMap;

    } catch (error) {
      console.error('Error generating events with aggregation:', error);
      throw error;
    }
  }

  static async getCalenderData(req, res) {
    // console.log("Fetching calendar data for user:", req);
    const { id } = req.user;
    const { year, month } = req?.params;
    try {
      const userId = id;
      // const year = year;
      // const month = month; 
      // console.log(`Fetching calendar data for user ${userId} for ${year}-${month}`);
      // Use EventLogger.methodName for static methods
      const eventsMap = await EventLogger.generateEventsFromDatabase(userId, year, month);
      // console.log(`📅 Calendar data for user :`, eventsMap);  
      res.status(200).json({
        status: 200,
        message: 'Calender Data',
        data: eventsMap
      });

    } catch (error) {
      console.error('Error in example:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = EventLogger;