// models/Leave.js (Enhanced)
const mongoose = require('mongoose');
const { Schema } = mongoose;

const leaveSchema = new Schema({
  employeeId: { 
    type: Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },
  type: {
    type: String,
    required: true
  },
  startDate: { 
    type: Date, 
    required: true 
  },
  endDate: { 
    type: Date, 
    required: true 
  },
  totalDays: { 
    type: Number, 
    required: true 
  },
  reason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    default: 'pending'
  },
  
  // Enhanced leave breakdown tracking
  leaveBreakdown: {
    fromAllocation: { 
      type: Number, 
      default: 0 
    }, // Days taken from allocated leave balance
    fromNormalLeave: { 
      type: Number, 
      default: 0 
    }, // Days taken as normal leave (unpaid/deduction)
    isHalfDay: { 
      type: Boolean, 
      default: false 
    },
    calculationDetails: {
      availableBalance: { type: Number, default: 0 },
      requestedDays: { type: Number, default: 0 },
      allocationUsed: { type: Number, default: 0 },
      normalLeaveUsed: { type: Number, default: 0 },
      message: String
    }
  },
  
  // Approval tracking
  approvedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User' 
  },
  approvalDate: Date,
  rejectionReason: String,
  
  // Enhanced attachments
  attachments: [{
    name: String,
    url: String,
    uploadedAt: Date,
    fileType: String,
    fileSize: Number
  }],
  
  // System tracking
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Indexes for better performance
leaveSchema.index({ employeeId: 1, startDate: 1, endDate: 1 });
leaveSchema.index({ status: 1 });
leaveSchema.index({ type: 1 });
leaveSchema.index({ 'leaveBreakdown.fromNormalLeave': 1 });

// Pre-save middleware
leaveSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual fields
leaveSchema.virtual('isActive').get(function() {
  return this.status === 'approved' || this.status === 'pending';
});

leaveSchema.virtual('hasNormalLeaveDeduction').get(function() {
  return this.leaveBreakdown.fromNormalLeave > 0;
});

leaveSchema.virtual('leaveTypeDisplay').get(function() {
  if (this.hasNormalLeaveDeduction) {
    return `${this.type} (${this.leaveBreakdown.fromAllocation} allocated + ${this.leaveBreakdown.fromNormalLeave} normal)`;
  }
  return this.type;
});

// Instance methods
leaveSchema.methods.calculateLeaveBreakdown = function(availableBalance, companySettings) {
  const requestedDays = this.totalDays;
  
  if (requestedDays <= availableBalance) {
    // All days can be taken from allocation
    this.leaveBreakdown.fromAllocation = requestedDays;
    this.leaveBreakdown.fromNormalLeave = 0;
    this.leaveBreakdown.calculationDetails = {
      availableBalance,
      requestedDays,
      allocationUsed: requestedDays,
      normalLeaveUsed: 0,
      message: `${requestedDays} days deducted from ${this.type} allocation`
    };
  } else {
    // Some days from allocation, rest as normal leave
    this.leaveBreakdown.fromAllocation = Math.max(0, availableBalance);
    this.leaveBreakdown.fromNormalLeave = requestedDays - Math.max(0, availableBalance);
    this.leaveBreakdown.calculationDetails = {
      availableBalance,
      requestedDays,
      allocationUsed: Math.max(0, availableBalance),
      normalLeaveUsed: this.leaveBreakdown.fromNormalLeave,
      message: `${Math.max(0, availableBalance)} days from ${this.type} allocation + ${this.leaveBreakdown.fromNormalLeave} normal leave days`
    };
  }
  
  return this.leaveBreakdown;
};

leaveSchema.methods.getImpactSummary = function() {
  if (this.leaveBreakdown.fromNormalLeave > 0) {
    return {
      hasDeduction: true,
      allocationDays: this.leaveBreakdown.fromAllocation,
      normalLeaveDays: this.leaveBreakdown.fromNormalLeave,
      totalDays: this.totalDays,
      message: this.leaveBreakdown.calculationDetails.message || 
               `This leave will use ${this.leaveBreakdown.fromAllocation} days from your allocation and ${this.leaveBreakdown.fromNormalLeave} normal leave days`,
      warning: 'Normal leave days may result in salary deduction or unpaid leave'
    };
  }
  
  return {
    hasDeduction: false,
    allocationDays: this.leaveBreakdown.fromAllocation,
    normalLeaveDays: 0,
    totalDays: this.totalDays,
    message: `${this.totalDays} days will be deducted from your ${this.type} allocation`,
    warning: null
  };
};

// Static methods
leaveSchema.statics.getOverlappingLeaves = function(employeeId, startDate, endDate, excludeId = null) {
  const query = {
    employeeId,
    status: { $in: ['pending', 'approved'] },
    $or: [
      {
        startDate: { $lte: endDate },
        endDate: { $gte: startDate }
      }
    ]
  };
  
  if (excludeId) {
    query._id = { $ne: excludeId };
  }
  
  return this.find(query);
};

leaveSchema.statics.getLeaveUsageByType = function(employeeId, leaveType, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  
  return this.aggregate([
    {
      $match: {
        employeeId,
        type: leaveType,
        status: 'approved',
        startDate: { $lte: yearEnd },
        endDate: { $gte: yearStart }
      }
    },
    {
      $group: {
        _id: null,
        totalDays: { $sum: '$totalDays' },
        fromAllocation: { $sum: '$leaveBreakdown.fromAllocation' },
        fromNormalLeave: { $sum: '$leaveBreakdown.fromNormalLeave' },
        count: { $sum: 1 }
      }
    }
  ]);
};

leaveSchema.statics.getNormalLeaveUsage = function(employeeId, year) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  
  return this.aggregate([
    {
      $match: {
        employeeId,
        status: 'approved',
        startDate: { $lte: yearEnd },
        endDate: { $gte: yearStart },
        'leaveBreakdown.fromNormalLeave': { $gt: 0 }
      }
    },
    {
      $group: {
        _id: null,
        totalNormalLeaveDays: { $sum: '$leaveBreakdown.fromNormalLeave' },
        leaveTypes: { $addToSet: '$type' },
        count: { $sum: 1 }
      }
    }
  ]);
};

module.exports = mongoose.model('Leave', leaveSchema);