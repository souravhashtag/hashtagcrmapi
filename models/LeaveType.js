const mongoose = require('mongoose');
const { Schema } = mongoose;

const LeaveTypeSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  monthlyDays:{
    type: Number,
    default: 0
  },
  leaveCount: {
    type: Number,
    default: 0
  },
  carryforward: {
    type: Boolean,
    default: true
  },
  ispaidLeave: {
    type: Boolean,
    default: false
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });


module.exports = mongoose.model('LeaveType', LeaveTypeSchema);