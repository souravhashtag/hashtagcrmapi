const mongoose = require('mongoose');
const { Schema } = mongoose;

const payrollSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  salaryStructure: {
    basic: { type: Number, required: true },
    hra: { type: Number, required: true },
    allowances: { type: Number, required: true },
    bonus: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    otherEarnings: { type: Number, default: 0 }
  },
  deductions: [{
    type: {
      type: String,
      // enum: ['tax', 'hInsurance', 'pf', 'esi', 'pTax', 'tds', 'loan', 'advance', 'other']
    },
    amount: Number,
    description: String
  }],
  bonus: { type: Number, default: 0 },
  overtimePay: { type: Number, default: 0 },
  totalDeductions: { type: Number, default: 0 },
  grossSalary: { type: Number, required: true },
  netSalary: { type: Number, required: true },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed'],
    default: 'pending'
  },
  paymentDate: Date,
  paymentMethod: {
    type: String,
    // enum: ['bank_transfer', 'check', 'cash', 'online']
  },
  transactionId: String,
  payslipUrl: String,
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payroll', payrollSchema);
