const mongoose = require('mongoose');

const screenShotSchema = new mongoose.Schema({
  userid: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      required: true
    },
  image: {
    type: String,
    required: true
  }
},{
  timestamps: true 
});

module.exports = mongoose.model('ScreenShot', screenShotSchema);
