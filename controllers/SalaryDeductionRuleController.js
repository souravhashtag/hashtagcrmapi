const SalaryDeductionRule = require('../models/SalaryDeductionRule');

function ensureNumber(n, field = 'value') {
  const v = Number(n);
  if (Number.isNaN(v)) throw new Error(`${field} must be a number`);
  return v;
}

function normalizeBoolean(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return Boolean(v);
}

/**
 * POST /api/salary-deductions/percent
 * Body: { code, name?, percent, is_applicable?, active?, tax_slab? }
 * Upsert a PERCENT rule (calculation_mode='percent') keyed by `code`.
 * `amount` will carry the percent number (e.g., 12 -> 12%).
 */
exports.upsertPercent = async (req, res) => {
  try {
    const {
      code,
      name,
      percent,
      is_applicable = true,
      active = true,
      tax_slab = []
    } = req.body || {};

    if (!code) {
      return res.status(400).json({ success: false, error: 'code is required' });
    }

    const p = ensureNumber(percent, 'percent');
    if (p < 0) {
      return res.status(400).json({ success: false, error: 'percent must be >= 0' });
    }

    const payload = {
      name: name || `${String(code).toUpperCase()} (${p}%)`,
      code: String(code).toLowerCase(),
      is_applicable: normalizeBoolean(is_applicable),
      calculation_mode: 'percent',
      amount: p,     // <-- percent stored here (schema uses one "amount" field)
      tax_slab: Array.isArray(tax_slab) ? tax_slab : [],
      active: normalizeBoolean(active),
    };

    const doc = await SalaryDeductionRule.findOneAndUpdate(
      { code: payload.code },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ success: true, data: doc });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

/**
 * POST /api/salary-deductions/fixed
 * Body: { code, name?, amount, is_applicable?, active?, tax_slab? }
 * Upsert a FIXED rule (calculation_mode='fixed') keyed by `code`.
 */
exports.upsertFixed = async (req, res) => {
  try {
    const {
      code,
      name,
      amount,
      is_applicable = true,
      active = true,
      tax_slab = []
    } = req.body || {};

    if (!code) {
      return res.status(400).json({ success: false, error: 'code is required' });
    }

    const a = ensureNumber(amount, 'amount');
    if (a < 0) {
      return res.status(400).json({ success: false, error: 'amount must be >= 0' });
    }

    const payload = {
      name: name || `${String(code).toUpperCase()} (Fixed ${a})`,
      code: String(code).toLowerCase(),
      is_applicable: normalizeBoolean(is_applicable),
      calculation_mode: 'fixed',
      amount: a,     // <-- fixed amount stored here
      tax_slab: Array.isArray(tax_slab) ? tax_slab : [],
      active: normalizeBoolean(active),
    };

    const doc = await SalaryDeductionRule.findOneAndUpdate(
      { code: payload.code },
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return res.status(201).json({ success: true, data: doc });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

/**
 * PATCH /api/salary-deductions/:id/percent
 * Body: { percent, name?, is_applicable?, active?, tax_slab? }
 * Force rule to PERCENT mode and update percent value and other fields.
 */
exports.updatePercentById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      percent,
      name,
      is_applicable,
      active,
      tax_slab
    } = req.body || {};

    const update = {
      calculation_mode: 'percent'
    };

    if (percent != null) {
      const p = ensureNumber(percent, 'percent');
      if (p < 0) {
        return res.status(400).json({ success: false, error: 'percent must be >= 0' });
      }
      update.amount = p; // percent value
    }
    if (name != null) update.name = name;
    if (is_applicable != null) update.is_applicable = normalizeBoolean(is_applicable);
    if (active != null) update.active = normalizeBoolean(active);
    if (tax_slab != null) update.tax_slab = Array.isArray(tax_slab) ? tax_slab : [];

    const doc = await SalaryDeductionRule.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: 'Rule not found' });

    return res.json({ success: true, data: doc });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

/**
 * PATCH /api/salary-deductions/:id/fixed
 * Body: { amount, name?, is_applicable?, active?, tax_slab? }
 * Force rule to FIXED mode and update amount and other fields.
 */
exports.updateFixedById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      amount,
      name,
      is_applicable,
      active,
      tax_slab
    } = req.body || {};

    const update = {
      calculation_mode: 'fixed'
    };

    if (amount != null) {
      const a = ensureNumber(amount, 'amount');
      if (a < 0) {
        return res.status(400).json({ success: false, error: 'amount must be >= 0' });
      }
      update.amount = a;
    }
    if (name != null) update.name = name;
    if (is_applicable != null) update.is_applicable = normalizeBoolean(is_applicable);
    if (active != null) update.active = normalizeBoolean(active);
    if (tax_slab != null) update.tax_slab = Array.isArray(tax_slab) ? tax_slab : [];

    const doc = await SalaryDeductionRule.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: 'Rule not found' });

    return res.json({ success: true, data: doc });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

/**
 * POST /api/salary-deductions
 * Body: { code, name, calculation_mode: 'fixed'|'percent', amount, is_applicable?, active?, tax_slab? }
 * Generic create that honors your schema directly.
 */
exports.createRule = async (req, res) => {
  try {
    const {
      code,
      name,
      calculation_mode,
      amount,
      is_applicable = true,
      active = true,
      tax_slab = []
    } = req.body || {};

    if (!code) return res.status(400).json({ success: false, error: 'code is required' });
    if (!name) return res.status(400).json({ success: false, error: 'name is required' });
    if (!['fixed', 'percent'].includes(calculation_mode)) {
      return res.status(400).json({ success: false, error: "calculation_mode must be 'fixed' or 'percent'" });
    }
    const a = ensureNumber(amount, 'amount');
    if (a < 0) return res.status(400).json({ success: false, error: 'amount must be >= 0' });

    const doc = await SalaryDeductionRule.create({
      code: String(code).toLowerCase(),
      name: name.trim(),
      calculation_mode,
      amount: a,
      is_applicable: normalizeBoolean(is_applicable),
      active: normalizeBoolean(active),
      tax_slab: Array.isArray(tax_slab) ? tax_slab : []
    });

    return res.status(201).json({ success: true, data: doc });
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message });
  }
};

// GET /api/salary-deductions
exports.listRules = async (_req, res) => {
  const items = await SalaryDeductionRule.find().sort({ active: -1, _id: 1 });
  res.json({ success: true, data: items });
};

// GET /api/salary-deductions/:id
exports.getRule = async (req, res) => {
  const doc = await SalaryDeductionRule.findById(req.params.id);
  if (!doc) return res.status(404).json({ success: false, error: 'Rule not found' });
  res.json({ success: true, data: doc });
};

// DELETE /api/salary-deductions/:id
exports.deleteRule = async (req, res) => {
  const del = await SalaryDeductionRule.findByIdAndDelete(req.params.id);
  if (!del) return res.status(404).json({ success: false, error: 'Rule not found' });
  res.json({ success: true, message: 'Rule deleted' });
};
