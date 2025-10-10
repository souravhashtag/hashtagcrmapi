const mongoose = require('mongoose');
const { Schema } = mongoose;

const ruleSchema = new Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, lowercase: true },
  is_applicable: {
    type: Boolean,
    required: true
  },
  calculation_mode: { 
    type: String, 
    // enum: ['fixed', 'percent'], 
    required: true 
  },
  amount: { type: Number,  min: 0 },
  tax_slab: { type: Array, default: [] },
  active: { type: Boolean, default: true },  
}, { 
  timestamps: true 
});

module.exports = mongoose.model('salarydeductionrules', ruleSchema);