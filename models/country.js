const mongoose = require('mongoose');
const { Schema } = mongoose;

const StateSchema = new Schema(
  {
    code: { type: String, trim: true, index: true },   // e.g., "B"
    name: { type: String, required: true, trim: true },// e.g., "Burgenland"
    subdivision: { type: String, trim: true }          // optional (fix for "ubdivisio")
  },
  { _id: false }
);

const CountrySchema = new Schema(
  {
    code2: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 2,
      maxlength: 2,
      index: true,
      unique: true
    },
    code3: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      index: true,
      unique: true
    },
    name: { type: String, required: true, trim: true, index: true },
    capital: { type: String, trim: true },
    region: { type: String, trim: true },              // e.g., "Europe"
    subregion: { type: String, trim: true },           // e.g., "Western Europe"
    states: { type: [StateSchema], default: [] }
  },
  { timestamps: true }
);

// Useful indexes
CountrySchema.index({ name: 1 });
CountrySchema.index({ region: 1, subregion: 1 });
CountrySchema.index({ 'states.code': 1 });
CountrySchema.index({ 'states.name': 1 });

module.exports = mongoose.model('Country', CountrySchema);
