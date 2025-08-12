const mongoose = require('mongoose');
const { Schema } = mongoose;

const LeaveTypeSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  leaveCount: {
    type: Number,
    default: 0 
  },
  ispaidLeave: {
    type: Boolean,
    default: false
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });


module.exports = mongoose.model('LeaveType', LeaveTypeSchema);