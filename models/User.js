const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  password: { 
    type: String, 
    required: true 
  },
  firstName: { 
    type: String, 
    required: true 
  },
  lastName: { 
    type: String, 
    required: true 
  },
  phone: String,
  profilePicture: String,
  role: {
    type: String,
    enum: ['admin', 'sales', 'support', 'employee', 'customer'],
    required: true
  },
  permissions: [String], 
  department: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Department' 
  },
  position: String,
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: 'active'
  },
  lastLogin: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.methods.hasPermission = function(permissionCode) {
  return this.permissions.includes(permissionCode);
};

const User = mongoose.model('User', userSchema);

module.exports = User;