const mongoose = require('mongoose');
const { Schema } = mongoose;

const designationSchema = new Schema({
  title: { type: String, required: true, unique: true },
  department: { type: Schema.Types.ObjectId, ref: 'Department' },
  description: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

designationSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Designation', designationSchema);
