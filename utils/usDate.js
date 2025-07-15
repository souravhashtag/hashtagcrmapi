const moment = require('moment-timezone');

const TIMEZONE = 'America/Los_Angeles';

/**
 * Returns formatted string of current California time.
 * Example: "07/07/2025, 03:15:27 AM"
 */
function getUSDateString() {
  return moment().tz(TIMEZONE).format('MM/DD/YYYY, hh:mm:ss A');
}

/**
 * Returns formatted string of just date in California timezone.
 * Example: "07/07/2025"
 */
function getUSDateOnlyString() {
  return moment().tz(TIMEZONE).format('MM/DD/YYYY');
}

/**
 * Returns ISO-formatted string in California time (safest for storing).
 * Example: "2025-07-07T03:15:27-07:00"
 */
function getUSDateISO() {
  return moment().tz(TIMEZONE).format(); // ISO string with correct offset
}

/**
 * Returns native JS Date object (in UTC), but from California time.
 * ⚠️ Appears as UTC date due to JS limitations — use only if you're okay with UTC.
 */
function getUSDate() {
  return moment().tz(TIMEZONE).toDate(); // still in UTC internally
}

module.exports = {
  getUSDate,
  getUSDateString,
  getUSDateOnlyString,
  getUSDateISO,
};
