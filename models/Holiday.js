// models/Holiday.js
const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['national', 'religious', 'company'],
    default: 'company'
  },
  isRecurring: {
    type: Boolean,
    default: false
  },
  year: {
    type: Number,
    default: function () {
      return this.date.getFullYear();
    }
  },
  appliesTo: {
    type: [String], // e.g. ['all', 'engineering']
    default: ['all']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Holiday', holidaySchema);
