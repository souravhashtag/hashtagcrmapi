const mongoose = require('mongoose');
const { Schema } = mongoose;

const companySchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  domain: {
    type: String, 
    required: true,
    unique: true,
    lowercase: true
  },
  logo: String,
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    zipCode: String
  },
  contactInfo: {
    phone: String,
    email: {
      type: String,
      lowercase: true,
      trim: true
    },
    website: String
  },
  // CEO Information
  ceo: {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    signature: String,
    bio: String,
    profileImage: String
  },
  settings: {
    // CEO Talk settings
    ceoTalk: {
      Message: {
        type: String,
        default: "Thank you for reaching out. Your success is our priority. We will get back to you soon."
      }
    },
    
    // Enhanced recipient system
    recipients: {
      to: [{
        type: {
          type: String,
          enum: ['user', 'group', 'external'],
          required: true
        },
        id: Schema.Types.ObjectId, // User ID or Group ID
        email: {
          type: String,
          lowercase: true,
          trim: true
        }, // For external emails
        name: String, // Display name
        status: {
          type: String,
          enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
          default: 'pending'
        },
        sentAt: Date,
        deliveredAt: Date,
        readAt: Date,
        failureReason: String
      }],
      cc: [{
        type: {
          type: String,
          enum: ['user', 'group', 'external'],
          required: true
        },
        id: Schema.Types.ObjectId,
        email: {
          type: String,
          lowercase: true,
          trim: true
        },
        name: String,
        status: {
          type: String,
          enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
          default: 'pending'
        },
        sentAt: Date,
        deliveredAt: Date,
        readAt: Date,
        failureReason: String
      }],
      bcc: [{
        type: {
          type: String,
          enum: ['user', 'group', 'external'],
          required: true
        },
        id: Schema.Types.ObjectId,
        email: {
          type: String,
          lowercase: true,
          trim: true
        },
        name: String,
        status: {
          type: String,
          enum: ['pending', 'sent', 'delivered', 'read', 'failed'],
          default: 'pending'
        },
        sentAt: Date,
        deliveredAt: Date,
        readAt: Date,
        failureReason: String
      }]
    },
    
    // Email metadata
    sender: {
      userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      email: {
        type: String,
        lowercase: true,
        trim: true
      },
      name: String
    }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

companySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
companySchema.index({ domain: 1 }, { unique: true });
companySchema.index({ 'ceo.userId': 1 });
companySchema.index({ 'contactInfo.email': 1 });

// Methods to manage leave allocations
companySchema.methods.getLeaveAllocation = function(leaveType) {
  // First check dynamic allocations
  const dynamicType = this.settings.leaveAllocations.types.find(
    type => type.name === leaveType && type.isActive
  );
  
  if (dynamicType) {
    return dynamicType.allocation;
  }
  
  // Fallback to legacy settings
  switch(leaveType) {
    case 'casual':
      return this.settings.leaves.casualLeaves;
    case 'medical':
      return this.settings.leaves.medicalLeaves;
    case 'paid':
      return this.settings.leaves.paidLeaves;
    default:
      return 0;
  }
};

companySchema.methods.getLeaveTypeConfig = function(leaveType) {
  return this.settings.leaveAllocations.types.find(
    type => type.name === leaveType && type.isActive
  );
};

companySchema.methods.getAllActiveLeaveTypes = function() {
  return this.settings.leaveAllocations.types.filter(type => type.isActive);
};

companySchema.methods.addLeaveType = function(leaveTypeConfig) {
  this.settings.leaveAllocations.types.push(leaveTypeConfig);
  return this.save();
};

companySchema.methods.updateLeaveType = function(leaveTypeName, updates) {
  const typeIndex = this.settings.leaveAllocations.types.findIndex(
    type => type.name === leaveTypeName
  );
  
  if (typeIndex !== -1) {
    Object.assign(this.settings.leaveAllocations.types[typeIndex], updates);
    return this.save();
  }
  return false;
};

companySchema.methods.removeLeaveType = function(leaveTypeName) {
  this.settings.leaveAllocations.types = this.settings.leaveAllocations.types.filter(
    type => type.name !== leaveTypeName
  );
  return this.save();
};

// Export all models
module.exports = {
  Company: mongoose.model('Company', companySchema)
};