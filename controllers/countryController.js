const Country = require('../models/country');


const mapDuplicate = (err) => {
  if (err?.code === 11000) return { status: 409, message: 'Duplicate key (code2/code3/name)' };
  return { status: 400, message: err.message };
};

const normalizeCountryPayload = (body) => {
  const payload = { ...body };
  if (payload.code2) payload.code2 = String(payload.code2).toUpperCase();
  if (payload.code3) payload.code3 = String(payload.code3).toUpperCase();
  if (Array.isArray(payload.states)) {
    payload.states = payload.states.map(s => ({
      code: s.code ? String(s.code).trim() : undefined,
      name: s.name ? String(s.name).trim() : undefined,
      subdivision: s.subdivision ? String(s.subdivision).trim() : undefined
    }));
  }
  return payload;
};

// ---------- CRUD ----------
exports.createCountry = async (req, res) => {
  try {
    const payload = normalizeCountryPayload(req.body);
    const doc = new Country(payload);
    const saved = await doc.save();
    return res.status(201).json(saved);
  } catch (err) {
    const { status, message } = mapDuplicate(err);
    return res.status(status).json({ error: message });
  }
};

exports.listCountries = async (req, res) => {
  try {
    const {
      q, region, subregion,
      page = 1, limit = 50, sort = 'name:asc'
    } = req.query;

    const filter = {};
    if (q) {
      const rx = new RegExp(q, 'i');
      filter.$or = [{ name: rx }, { code2: rx }, { code3: rx }, { capital: rx }];
    }
    if (region) filter.region = new RegExp(`^${region}$`, 'i');
    if (subregion) filter.subregion = new RegExp(`^${subregion}$`, 'i');

    const sortObj = {};
    (sort || '').split(',').forEach(pair => {
      const [k, dir = 'asc'] = pair.split(':');
      if (k) sortObj[k] = dir.toLowerCase() === 'desc' ? -1 : 1;
    });

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const skip = (p - 1) * l;

    const [items, total] = await Promise.all([
      Country.find(filter).sort(sortObj).skip(skip).limit(l),
      Country.countDocuments(filter)
    ]);

    return res.json({ items, page: p, limit: l, total, pages: Math.ceil(total / l) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getCountry = async (req, res) => {
  try {
    const { idOrCode } = req.params;
    let doc;

    if (/^[A-Za-z]{2}$/.test(idOrCode)) {
      doc = await Country.findOne({ code2: idOrCode.toUpperCase() });
    } else if (/^[A-Za-z]{3}$/.test(idOrCode)) {
      doc = await Country.findOne({ code3: idOrCode.toUpperCase() });
    } else {
      doc = await Country.findById(idOrCode);
    }

    if (!doc) return res.status(404).json({ error: 'Country not found' });
    return res.json(doc);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

exports.updateCountry = async (req, res) => {
  try {
    const payload = normalizeCountryPayload(req.body);
    const { idOrCode } = req.params;

    const query =
      /^[A-Za-z]{2}$/.test(idOrCode) ? { code2: idOrCode.toUpperCase() } :
      /^[A-Za-z]{3}$/.test(idOrCode) ? { code3: idOrCode.toUpperCase() } :
      { _id: idOrCode };

    const updated = await Country.findOneAndUpdate(query, payload, {
      new: true,
      runValidators: true
    });

    if (!updated) return res.status(404).json({ error: 'Country not found' });
    return res.json(updated);
  } catch (err) {
    const { status, message } = mapDuplicate(err);
    return res.status(status).json({ error: message });
  }
};

exports.deleteCountry = async (req, res) => {
  try {
    const { idOrCode } = req.params;

    const query =
      /^[A-Za-z]{2}$/.test(idOrCode) ? { code2: idOrCode.toUpperCase() } :
      /^[A-Za-z]{3}$/.test(idOrCode) ? { code3: idOrCode.toUpperCase() } :
      { _id: idOrCode };

    const deleted = await Country.findOneAndDelete(query);
    if (!deleted) return res.status(404).json({ error: 'Country not found' });

    return res.json({ message: 'Country deleted', country: deleted });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// ---------- State helpers ----------
exports.addOrUpdateState = async (req, res) => {
  try {
    const { idOrCode } = req.params;
    const { state } = req.body; // { code?, name, subdivision? }

    if (!state?.name) {
      return res.status(400).json({ error: 'State name is required' });
    }

    const query =
      /^[A-Za-z]{2}$/.test(idOrCode) ? { code2: idOrCode.toUpperCase() } :
      /^[A-Za-z]{3}$/.test(idOrCode) ? { code3: idOrCode.toUpperCase() } :
      { _id: idOrCode };

    const country = await Country.findOne(query);
    if (!country) return res.status(404).json({ error: 'Country not found' });

    const codeNorm = state.code ? String(state.code).trim() : undefined;
    const nameNorm = String(state.name).trim();
    const subdivisionNorm = state.subdivision ? String(state.subdivision).trim() : undefined;

    const idx = country.states.findIndex(s =>
      (codeNorm && s.code === codeNorm) || s.name.toLowerCase() === nameNorm.toLowerCase()
    );

    if (idx >= 0) {
      // update existing
      country.states[idx].code = codeNorm ?? country.states[idx].code;
      country.states[idx].name = nameNorm;
      country.states[idx].subdivision = subdivisionNorm ?? country.states[idx].subdivision;
    } else {
      // push new
      country.states.push({ code: codeNorm, name: nameNorm, subdivision: subdivisionNorm });
    }

    await country.save();
    return res.json({ message: 'State upserted', states: country.states });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

exports.removeState = async (req, res) => {
  try {
    const { idOrCode, stateKey } = req.params; // stateKey can be code or name

    const query =
      /^[A-Za-z]{2}$/.test(idOrCode) ? { code2: idOrCode.toUpperCase() } :
      /^[A-Za-z]{3}$/.test(idOrCode) ? { code3: idOrCode.toUpperCase() } :
      { _id: idOrCode };

    const country = await Country.findOne(query);
    if (!country) return res.status(404).json({ error: 'Country not found' });

    const before = country.states.length;
    country.states = country.states.filter(
      s => s.code !== stateKey && s.name.toLowerCase() !== stateKey.toLowerCase()
    );

    if (country.states.length === before) {
      return res.status(404).json({ error: 'State not found' });
    }

    await country.save();
    return res.json({ message: 'State removed', states: country.states });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// ---------- Bulk upsert ----------
/**
 * Accepts an array like:
 * [
 *   { code2, code3, name, capital, region, subregion, states: [{code, name, subdivision}] },
 *   ...
 * ]
 * Upserts by code2/code3.
 */
exports.bulkUpsertCountries = async (req, res) => {
  try {
    const payload = Array.isArray(req.body) ? req.body : [];
    if (!payload.length) return res.status(400).json({ error: 'Array payload required' });

    console.log('Payload items:', payload.length, 'Size:', JSON.stringify(req.body).length, 'bytes');

    const BATCH_SIZE = 10000;
    let totalUpserts = 0;
    let totalValidOps = 0;

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const slice = payload.slice(i, i + BATCH_SIZE);

      const ops = slice.map(raw => {
        const doc = normalizeCountryPayload(raw);
        const filter = doc.code2 ? { code2: doc.code2 } : doc.code3 ? { code3: doc.code3 } : null;
        if (!filter) {
          console.log('Invalid item:', raw);
          return null;
        }
        return {
          updateOne: { filter, update: { $set: doc }, upsert: true }
        };
      }).filter(Boolean);

      if (ops.length) {
        const result = await Country.bulkWrite(ops, { ordered: false });
        totalUpserts += (result.upsertedCount || 0) + (result.modifiedCount || 0);
        totalValidOps += ops.length;
      }
    }

    if (!totalValidOps) return res.status(400).json({ error: 'No valid items to upsert' });

    return res.json({
      ok: true,
      totalProcessed: payload.length,
      totalValid: totalValidOps,
      totalUpserts
    });
  } catch (err) {
    console.error('Error in bulkUpsertCountries:', err);
    const { status, message } = mapDuplicate(err);
    return res.status(status).json({ error: message });
  }
};