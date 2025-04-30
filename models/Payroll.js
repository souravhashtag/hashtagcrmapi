const mongoose = require('mongoose');
const { Schema } = mongoose;

const payrollSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  basicSalary: { type: Number, required: true },

  allowances: [{
    type: {
      type: String,
      enum: ['housing', 'travel', 'food', 'medical', 'other']
    },
    amount: Number,
    description: String
  }],

  deductions: [{
    type: {
      type: String,
      enum: ['tax', 'insurance', 'loan', 'advance', 'other']
    },
    amount: Number,
    description: String
  }],

  bonus: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },

  netSalary: { type: Number, required: true },

  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed'],
    default: 'pending'
  },

  paymentDate: Date,

  paymentMethod: {
    type: String,
    enum: ['bank-transfer', 'check', 'cash', 'online']
  },

  transactionId: String,
  payslipUrl: String,
  notes: String,

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payroll', payrollSchema);
