const mongoose = require('mongoose');
const { Schema } = mongoose;

const employeeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  employeeId: { type: String, unique: true },
  employmentType: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship'],
  },
  joiningDate: { type: Date, required: true },
  dob: { type: Date, required: true },
  workingTimezone: { type: String, required: true },
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
  deductionDetails: [String],
  issetrosterauto: { type: Boolean, default: false },
  taxInformation: {
    pan: String,
    uan: String,
    pfNumber: String,
    esiNumber: String
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

employeeSchema.pre('save', async function (next) {
  this.updatedAt = Date.now();

  if (!this.employeeId) {
    const prefix = 'HBS';

    const lastEmployee = await this.constructor.findOne(
      { employeeId: { $regex: `^${prefix}\\d+$` } },
      { employeeId: 1 }
    ).sort({ employeeId: -1 });

    let nextNumber = 1;

    if (lastEmployee) {
      const lastNumber = parseInt(lastEmployee.employeeId.replace(prefix, ''));
      nextNumber = lastNumber + 1;
    }

    const formattedNumber = nextNumber.toString().padStart(3, '0');
    this.employeeId = `${prefix}${formattedNumber}`;
  }

  next();
});


module.exports = mongoose.model('Employee', employeeSchema);
