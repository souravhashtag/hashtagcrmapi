const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  clockIn: Date,
  clockOut: Date,
  totalHours: Number,
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day', 'work-from-home'],
    required: true
  },
  location: {
    latitude: Number,
    longitude: Number,
    ipAddress: String
  },
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
  next();
});

// Virtual to check if the employee was on-site
attendanceSchema.virtual('isRemote').get(function () {
  return this.status === 'work-from-home';
});

// Method to calculate total hours (if clockIn and clockOut are present)
attendanceSchema.methods.calculateTotalHours = function () {
  if (this.clockIn && this.clockOut) {
    const diff = (this.clockOut - this.clockIn) / (1000 * 60 * 60); // in hours
    this.totalHours = parseFloat(diff.toFixed(2));
  }
};

const Attendance = mongoose.model('Attendance', attendanceSchema);

module.exports = Attendance;
