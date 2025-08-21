const mongoose = require('mongoose');

// Roster Schema - One document per employee per week
const rosterSchema = new mongoose.Schema({
  employee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  
  // Week information
  week_start_date: {
    type: Date,
    required: true,
    index: true
  },
  week_end_date: {
    type: Date,
    required: true
  },
  week_number: {
    type: Number,
    required: true
  },
  year: {
    type: Number,
    required: true,
    index: true
  },
  
  // Daily schedules - Full datetime format for handling overnight shifts
  sunday: {
    start_time: {
      type: String,
      default: 'OFF'
      // Format: "19-08-2025 20:00" or "OFF"
    },
    end_time: {
      type: String,
      default: 'OFF'
      // Format: "20-08-2025 05:00" or "OFF"
    }
  },
  monday: {
    start_time: {
      type: String,
      default: 'OFF'
    },
    end_time: {
      type: String,
      default: 'OFF'
    }
  },
  tuesday: {
    start_time: {
      type: String,
      default: 'OFF'
    },
    end_time: {
      type: String,
      default: 'OFF'
    }
  },
  wednesday: {
    start_time: {
      type: String,
      default: 'OFF'
    },
    end_time: {
      type: String,
      default: 'OFF'
    }
  },
  thursday: {
    start_time: {
      type: String,
      default: 'OFF'
    },
    end_time: {
      type: String,
      default: 'OFF'
    }
  },
  friday: {
    start_time: {
      type: String,
      default: 'OFF'
    },
    end_time: {
      type: String,
      default: 'OFF'
    }
  },
  saturday: {
    start_time: {
      type: String,
      default: 'OFF'
    },
    end_time: {
      type: String,
      default: 'OFF'
    }
  },
  
  // Optional: Additional fields
  total_hours: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'approved'],
    default: 'draft'
  },
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
  
}, {
  timestamps: true
});

// Compound indexes for better performance
rosterSchema.index({ employee_id: 1, year: 1, week_number: 1 }, { unique: true });
rosterSchema.index({ week_start_date: 1, employee_id: 1 });

// Virtual for week identifier
rosterSchema.virtual('week_identifier').get(function() {
  return `${this.year}-W${this.week_number}`;
});

// Method to get working days count
rosterSchema.methods.getWorkingDays = function() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days.filter(day => this[day].start_time !== 'OFF' && this[day].end_time !== 'OFF').length;
};

// Method to calculate total hours
rosterSchema.methods.calculateTotalHours = function() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let totalHours = 0;
  
  days.forEach(day => {
    const daySchedule = this[day];
    if (daySchedule.start_time !== 'OFF' && daySchedule.end_time !== 'OFF') {
      // Convert time strings to minutes for calculation
      const startMinutes = this.timeToMinutes(daySchedule.start_time);
      const endMinutes = this.timeToMinutes(daySchedule.end_time);
      
      if (startMinutes !== null && endMinutes !== null) {
        const dayHours = (endMinutes - startMinutes) / 60;
        totalHours += dayHours;
      }
    }
  });
  
  return totalHours;
};

// Helper method to convert time string to minutes
rosterSchema.methods.timeToMinutes = function(timeString) {
  if (!timeString || timeString === 'OFF') return null;
  
  // Handle formats like "10:00", "10am", "10:30am", etc.
  const time24Match = timeString.match(/^(\d{1,2}):(\d{2})$/);
  if (time24Match) {
    return parseInt(time24Match[1]) * 60 + parseInt(time24Match[2]);
  }
  
  const time12Match = timeString.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (time12Match) {
    let hours = parseInt(time12Match[1]);
    const minutes = parseInt(time12Match[2] || '0');
    const ampm = time12Match[3].toLowerCase();
    
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  }
  
  return null;
};

// Method to get display format for a day
rosterSchema.methods.getDayDisplay = function(day) {
  const daySchedule = this[day];
  if (daySchedule.start_time === 'OFF' || daySchedule.end_time === 'OFF') {
    return 'OFF';
  }
  return `${daySchedule.start_time}-${daySchedule.end_time}`;
};

// Static method to get week roster for all employees with employee details
rosterSchema.statics.getWeekRoster = async function(year, weekNumber) {
  return await this.find({ 
    year: year, 
    week_number: weekNumber 
  })
  .populate({
    path: 'employee_id',
    populate: {
      path: 'userId',
      select: 'name email role department'
    }
  })
  .populate('created_by', 'name')
  .sort({ 'employee_id.employeeId': 1 });
};

// Static method to get employee roster for date range
rosterSchema.statics.getEmployeeRoster = async function(employeeId, startDate, endDate) {
  return await this.find({
    employee_id: employeeId,
    week_start_date: { $gte: startDate, $lte: endDate }
  })
  .populate({
    path: 'employee_id',
    populate: {
      path: 'userId',
      select: 'name email'
    }
  })
  .sort({ week_start_date: 1 });
};

module.exports = mongoose.model('Roster', rosterSchema);