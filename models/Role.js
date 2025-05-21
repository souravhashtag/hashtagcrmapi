const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, 
    trim: true
  },
  display_name: {
    type: String,
    default: null,
    trim: true
  },
  description: {
    type: String,
    default: null,
    trim: true
  },
  menulist: {
    type: [
        {
          name: { type: String },
          slug: { type: String }
        },
    ],
    default: []
  }
}, {
  timestamps: true 
});

module.exports = mongoose.model('Role', roleSchema);
