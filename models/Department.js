const mongoose = require('mongoose');
const { Schema } = mongoose;

const departmentSchema = new Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  manager: { type: Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

departmentSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Department', departmentSchema);
