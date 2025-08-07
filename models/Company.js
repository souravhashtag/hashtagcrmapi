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
    // Holiday configuration per company
    leaves: {
      casualLeaves: {
        type: Number,
        default: 12,
        min: 0,
        max: 50
      },
      medicalLeaves: {
        type: Number,
        default: 10,
        min: 0,
        max: 50
      }
    },
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
  },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
},
{ timestamps: true }
);

companySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

companySchema.index({ domain: 1 }, { unique: true });
companySchema.index({ 'ceo.userId': 1 });
companySchema.index({ 'contactInfo.email': 1 });


// Export all models
module.exports = {
  Company: mongoose.model('Company', companySchema)
};