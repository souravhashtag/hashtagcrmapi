const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    event_date: {
      type: Date,
      required: true
    },
    event_description: {
      type: String,
      required: true,
      trim: true
    },
    event_type: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Event', eventSchema);