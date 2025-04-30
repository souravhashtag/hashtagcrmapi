const mongoose = require('mongoose');
const { Schema } = mongoose;

const leaveSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  type: {
    type: String,
    enum: ['casual', 'sick', 'annual', 'maternity', 'paternity', 'unpaid', 'other'],
    required: true
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalDays: { type: Number, required: true },
  reason: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvalDate: Date,
  rejectionReason: String,
  attachments: [{
    name: String,
    url: String,
    uploadedAt: Date
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Leave', leaveSchema);
