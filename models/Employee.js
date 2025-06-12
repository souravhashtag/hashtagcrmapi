const mongoose = require('mongoose');
const { Schema } = mongoose;

const employeeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  employeeId: { type: String, required: true, unique: true },
  joiningDate: { type: Date, required: true },
  dob:{ type: Date, required: true },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  documents: [{
    type: { type: String, enum: ['id', 'contract', 'certificate', 'other'] },
    name: String,
    url: String,
    uploadedAt: Date
  }],
  bankDetails: {
    accountNumber: String,
    bankName: String,
    ifscCode: String,
    accountHolderName: String
  },
  salary: {
    amount: Number,
    currency: { type: String, default: 'USD' },
    paymentFrequency: { type: String, enum: ['monthly', 'bi-weekly', 'weekly'] }
  },
  taxInformation: {
    taxId: String,
    taxBracket: String
  },
  performanceReviews: [{
    reviewDate: Date,
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User' },
    ratings: {
      productivity: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      teamwork: { type: Number, min: 1, max: 5 },
      initiative: { type: Number, min: 1, max: 5 },
      overall: { type: Number, min: 1, max: 5 }
    },
    feedback: String,
    goals: [String]
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

employeeSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Employee', employeeSchema);
