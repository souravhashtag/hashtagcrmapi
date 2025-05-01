const mongoose = require('mongoose');

const PerformanceRecordSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  reviewPeriod: {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
  },
  reviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  goals: [
    {
      title: { type: String, required: true },
      description: String,
      target: String,
      achieved: String,
      status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed'],
        default: 'not_started',
      },
    },
  ],
  ratings: {
    communication: { type: Number, min: 1, max: 5 },
    teamwork: { type: Number, min: 1, max: 5 },
    problemSolving: { type: Number, min: 1, max: 5 },
    technicalSkills: { type: Number, min: 1, max: 5 },
    punctuality: { type: Number, min: 1, max: 5 },
    overall: { type: Number, min: 1, max: 5 },
  },
  feedback: {
    fromReviewer: String,
    fromEmployee: String,
  },
  promotionRecommended: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Performance', PerformanceRecordSchema);
