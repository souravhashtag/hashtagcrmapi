const mongoose = require('mongoose');
const { Schema } = mongoose;

const ruleSchema = new Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, lowercase: true },
  type: {
    type: String,
    enum: ['tax', 'hInsurance', 'pf', 'esi', 'pTax', 'tds', 'loan', 'advance', 'other'],
    required: true
  },
  compute: {
    mode: {
      type: String,
      enum: ['fixed', 'percent_of_basic', 'percent_of_gross'],
      required: true,
      default: 'percent_of_basic'
    },
    fixedAmount: { type: Number, default: 0 },
    percent: { type: Number, default: 0 }
  },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

ruleSchema.pre('validate', function(next) {
  // ensure compute object exists with defaults
  this.compute = this.compute || {};
  if (!this.compute.mode) this.compute.mode = 'percent_of_basic';
  if (this.compute.fixedAmount == null) this.compute.fixedAmount = 0;
  if (this.compute.percent == null) this.compute.percent = 0;
  next();
});

ruleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('SalaryDeductionRule', ruleSchema);