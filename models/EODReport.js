const mongoose = require('mongoose');
const { Schema } = mongoose;

const activitySchema = new Schema({
  activity: { type: String, required: true, trim: true },
  startTime: { type: String }, // e.g. "09:00"
  endTime: { type: String },
  description: { type: String },
  status: { 
    type: String, 
    enum: ["Pending", "Ongoing", "Completed"], 
    default: "Pending" 
  }
});

const breakSchema = new Schema({
  name: { type: String, required: true, trim: true }, // e.g. Lunch, Tea
  from: { type: String }, // start time
  to: { type: String },   // end time
  status: { 
    type: String, 
    enum: ["Pending", "Ongoing", "Completed"], 
    default: "Pending" 
  }
});

const eodReportSchema = new Schema({
  employeeName: { type: String, required: true },
  position: { type: String, required: true },
  department: { type: String, required: true },
  date: { type: String, required: true }, // yyyy-mm-dd
  activities: [activitySchema],
  breaks: [breakSchema],   // 👈 Added breaks
  plans: { type: String },
  issues: { type: String },
  comments: { type: String },
}, { timestamps: true });

module.exports = mongoose.model("EODReport", eodReportSchema);
