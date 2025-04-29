// models/Ticket.js

const mongoose = require('mongoose');
const { Schema, Types } = mongoose;

const ticketSchema = new Schema({
  ticketNumber: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  client: { type: Types.ObjectId, ref: 'Client', required: true },
  submittedBy: { type: Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: Types.ObjectId, ref: 'User' },
  department: { type: Types.ObjectId, ref: 'Department' },
  type: {
    type: String,
    enum: ['question', 'problem', 'feature-request', 'bug', 'other'],
    default: 'question'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['new', 'open', 'in-progress', 'on-hold', 'resolved', 'closed'],
    default: 'new'
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  dueDate: Date,
  resolvedDate: Date,
  closedDate: Date,
  resolution: String,
  sla: {
    responseTime: Number, // in hours
    resolutionTime: Number, // in hours
    breached: { type: Boolean, default: false }
  },
  attachments: [{
    name: String,
    url: String,
    uploadedAt: Date
  }],
  comments: [{
    user: { type: Types.ObjectId, ref: 'User' },
    text: String,
    isInternal: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now },
    attachments: [{
      name: String,
      url: String,
      uploadedAt: Date
    }]
  }],
  relatedTickets: [{ type: Types.ObjectId, ref: 'Ticket' }],
  tags: [String],
  satisfaction: {
    rating: { type: Number, min: 1, max: 5 },
    feedback: String,
    submittedAt: Date
  }
});

module.exports = mongoose.model('Ticket', ticketSchema);
