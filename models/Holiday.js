import { Schema, model } from 'mongoose';

const HolidaySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
    day: {
      type: String,
      required: true,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    type: {
      type: String,
      required: true,
      enum: ['national', 'regional', 'company', 'other'],
      default: 'national'
    },
    description: { type: String },
    isRecurring: { type: Boolean, required: true },
    appliesTo: { type: [String], required: true, default: ['all'] },
    createdAt: { type: Date, default: Date.now, immutable: true }
  },
  { versionKey: false }
);

// Optional: ensure no duplicate holiday names on the same date
HolidaySchema.index({ date: 1, name: 1 }, { unique: true });

export const Holiday = model('Holiday', HolidaySchema);
