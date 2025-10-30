const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String,
    required: true
  },
  clockIn: Date,
  clockInUs: String,
  clockOut: Date,
  clockOutUs: String,
  totalHours: Number,
  breaks: [
    {
      start: Date,
      startUs: String,
      end: Date,
      endUs: String
    }
  ],
  totalBreakDuration: {
    type: Number, 
    default: 0
  },
  status: {
    type: String,
    // enum: ['present', 'absent', 'late', 'half-day', 'work-from-home'],
    required: true
  },
  // location: {
  //   latitude: Number,
  //   longitude: Number,
  //   ipAddress: String
  // },
  location: String,
  screenshots: [
    {
      timestamp: Date,
      url: String
    }
  ],
  biometricData: {
    verificationMethod: {
      type: String,
      enum: ['fingerprint', 'facial', 'card', 'manual']
    },
    verificationTime: Date,
    verificationStatus: Boolean
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Auto-update `updatedAt` on save
attendanceSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  this.calculateTotalHours();
  next();
});
// Virtual to check if the employee was on-site
attendanceSchema.virtual('isRemote').get(function () {
  return this.status === 'work-from-home';
});

attendanceSchema.methods.calculateTotalHours = function () {
  if (this.clockIn && this.clockOut) {
    const workDuration = (this.clockOut - this.clockIn) / 1000; 

    const totalBreakInSeconds = this.breaks.reduce((acc, brk) => {
      if (brk.start && brk.end) {
        return acc + (brk.end - brk.start) / 1000;
      }
      return acc;
    }, 0);

    this.totalBreakDuration = Math.floor(totalBreakInSeconds);

    const netWorkSeconds = Math.max(workDuration - totalBreakInSeconds, 0);
    this.totalHours = parseFloat((netWorkSeconds / 3600).toFixed(2)); // in hours
  }
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
