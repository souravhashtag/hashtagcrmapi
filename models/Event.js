
const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const eventSchema = new Schema({
  title: { type: String, required: true },
  description: String,
  type: {
    type: String,
    enum: ['meeting', 'training', 'conference', 'webinar', 'other'],
    required: true
  },
  startDateTime: { type: Date, required: true },
  endDateTime: { type: Date, required: true },
  allDay: { type: Boolean, default: false },
  location: {
    type: {
      type: String,
      enum: ['in-person', 'online', 'hybrid']
    },
    address: String,
    online: {
      platform: String,
      link: String,
      meetingId: String,
      password: String
    }
  },
  organizer: { type: Types.ObjectId, ref: 'User', required: true },
  attendees: [{
    user: { type: Types.ObjectId, ref: 'User' },
    status: {
      type: String,
      enum: ['invited', 'confirmed', 'declined', 'tentative'],
      default: 'invited'
    },
    notificationSent: { type: Boolean, default: false }
  }],
  externalAttendees: [{
    name: String,
    email: String,
    phone: String,
    status: {
      type: String,
      enum: ['invited', 'confirmed', 'declined', 'tentative'],
      default: 'invited'
    },
    notificationSent: { type: Boolean, default: false }
  }],
  recurring: {
    isRecurring: { type: Boolean, default: false },
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'custom']
    },
    interval: Number,
    endsOn: Date,
    exceptions: [Date]
  },
  reminders: [{
    time: Number, 
    type: { type: String, enum: ['email', 'notification', 'sms'] },
    sent: { type: Boolean, default: false }
  }],
  attachments: [{
    name: String,
    url: String,
    uploadedAt: Date
  }],
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Event', eventSchema);
