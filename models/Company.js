const mongoose = require('mongoose');
const { Schema } = mongoose;

const companyDetailsSchema = new Schema({
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
        email: {
          type: String,
          lowercase: true,
          trim: true
        }, 
        name: String, 
      }],
      cc: [{
        email: {
          type: String,
          lowercase: true,
          trim: true
        },
        name: String
      }],
      bcc: [{
        email: {
          type: String,
          lowercase: true,
          trim: true
        },
        name: String
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

companyDetailsSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes
companyDetailsSchema.index({ domain: 1 }, { unique: true });
companyDetailsSchema.index({ 'ceo.userId': 1 });
companyDetailsSchema.index({ 'contactInfo.email': 1 });

// Methods to manage leave allocations
companyDetailsSchema.methods.getLeaveAllocation = function(leaveType) {
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


// Export all models
module.exports = {
  companyDetails: mongoose.model('companyDetails', companyDetailsSchema)
};