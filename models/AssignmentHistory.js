const mongoose = require('mongoose');
const { Schema } = mongoose;

const assignmentHistorySchema = new Schema({
  assignmentId: {
    type: Schema.Types.ObjectId,
    ref: 'EmployeeAssignment',
    required: true
  },
  action: {
    type: String,
    enum: ['created', 'updated', 'transferred', 'ended', 'reactivated'],
    required: true
  },
  performedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
  previousData: Schema.Types.Mixed,
  newData: Schema.Types.Mixed,
  reason: String,
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

module.exports = mongoose.model('AssignmentHistory', assignmentHistorySchema);