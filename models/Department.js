const mongoose = require('mongoose');
const { Schema } = mongoose;

const departmentSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

departmentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});
departmentSchema.virtual('employeeCount', {
  ref: 'User',
  localField: '_id',
  foreignField: 'department',
  count: true, 
});
departmentSchema.set('toJSON', { virtuals: true });
departmentSchema.set('toObject', { virtuals: true });
module.exports = mongoose.model('Department', departmentSchema);
