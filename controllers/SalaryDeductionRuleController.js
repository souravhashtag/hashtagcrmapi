const SalaryDeductionRule = require('../models/SalaryDeductionRule');

// map "basic" | "gross" -> your compute.mode values
function baseToMode(base = 'basic') {
    return String(base).toLowerCase() === 'gross'
        ? 'percent_of_gross'
        : 'percent_of_basic';
}

function ensureNumber(n, field = 'value') {
    const v = Number(n);
    if (Number.isNaN(v)) throw new Error(`${field} must be a number`);
    return v;
}

/**
 * POST /api/salary-deductions/percent
 * Body: { type: 'pf'|'esi'|'pTax'|..., percent: number, base: 'basic'|'gross', name?, code?, active? }
 * Upserts a percentage rule for a deduction type.
 */
exports.upsertPercent = async (req, res) => {
    try {
        const { type, percent, base = 'basic', code, name, active = true } = req.body || {};
        if (!type) return res.status(400).json({ success: false, error: 'type is required' });
        const p = Number(percent);
        if (Number.isNaN(p) || p < 0) return res.status(400).json({ success: false, error: 'percent must be a non-negative number' });

        const payload = {
            name: name || `${String(type).toUpperCase()} (${p}% of ${base === 'gross' ? 'Gross' : 'Basic'})`,
            code: (code || type).toString().toLowerCase(),
            type,
            compute: { mode: baseToMode(base), percent: p, fixedAmount: 0 },
            active: !!active
        };

        const doc = await SalaryDeductionRule.findOneAndUpdate(
            { code: payload.code },
            { $set: payload },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        res.status(201).json({ success: true, data: doc });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
};

/**
 * PATCH /api/salary-deductions/:id/percent
 * Body: { percent: number, base?: 'basic'|'gross', name?, active? }
 * Update percentage for an existing rule by id.
 */
exports.updatePercentById = async (req, res) => {
    try {
        const { id } = req.params;
        const { percent, base, name, active } = req.body || {};

        const update = {};
        if (percent != null) {
            const p = ensureNumber(percent, 'percent');
            if (p < 0) return res.status(400).json({ success: false, error: 'percent must be >= 0' });
            update['compute.percent'] = p;
        }
        if (base) update['compute.mode'] = baseToMode(base);
        if (name) update.name = name;
        if (active != null) update.active = Boolean(active);

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
 * OPTIONAL helpers (nice to have)
 */

// Create any rule (fixed or percent)
exports.createRule = async (req, res) => {
    try {
        const body = { ...req.body };
        if ((body.percent != null || body.base) && !body.compute) {
            const base = (body.base || 'basic').toLowerCase();
            body.compute = {
                mode: base === 'gross' ? 'percent_of_gross' : 'percent_of_basic',
                percent: Number(body.percent) || 0,
                fixedAmount: Number(body.fixedAmount) || 0
            };
            delete body.base;
            delete body.percent;
            delete body.fixedAmount;
        }
        const doc = await SalaryDeductionRule.create(body);
        res.status(201).json({ success: true, data: doc });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
};


// List rules
exports.listRules = async (_req, res) => {
    const items = await SalaryDeductionRule.find().sort({ active: -1, _id: 1 });
    res.json({ success: true, data: items });
};

// Get one
exports.getRule = async (req, res) => {
    const doc = await SalaryDeductionRule.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, data: doc });
};

// Delete
exports.deleteRule = async (req, res) => {
    const del = await SalaryDeductionRule.findByIdAndDelete(req.params.id);
    if (!del) return res.status(404).json({ success: false, error: 'Rule not found' });
    res.json({ success: true, message: 'Rule deleted' });
};
