function convertDatesToUSFormat(obj) {
  if (!obj || typeof obj !== 'object') return;

  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;

    const value = obj[key];

    if (
      (typeof value === 'string' || value instanceof Date) &&
      !isNaN(new Date(value).getTime())
    ) {
      const date = new Date(value);
      if (isNaN(value) || isNaN(Number(value))) {
        obj[key] = date.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          hour12: true,
        });
      }
    } else if (typeof value === 'object') {
      convertDatesToUSFormat(value);
    }
  }
}

module.exports = function convertAllDatesToUS(req, res, next) {
  if (req.body) {
    convertDatesToUSFormat(req.body);
  }
  next();
};
