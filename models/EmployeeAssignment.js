const mongoose = require('mongoose');
const { Schema } = mongoose;

const assignmentSchema = new Schema({
  supervisor: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  subordinate: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'pending', 'transferred'],
    default: 'active',
    index: true
  },
  assignedBy: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true
  },
}, {
  timestamps: true
});

// Indexes for performance
assignmentSchema.index({ supervisor: 1, status: 1 });
assignmentSchema.index({ subordinate: 1, status: 1 });
assignmentSchema.index({ supervisor: 1, subordinate: 1, status: 1 });

module.exports = mongoose.model('EmployeeAssignment', assignmentSchema);