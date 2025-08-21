const mongoose = require('mongoose');
const Payroll = require('../models/Payroll');

// -------- helpers --------
const sum = (arr = []) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

function calcTotals(doc) {
  const s = doc.salaryStructure || {};
  const baseBasic = Number(doc.basicSalary) || 0;

  // Prefer salaryStructure.basic if provided; else fall back to basicSalary
  const basic = Number(s.basic ?? baseBasic) || 0;
  const hra = Number(s.hra) || 0;
  const allowances = Number(s.allowances) || 0;
  const sBonus = Number(s.bonus) || 0;
  const sOvertime = Number(s.overtime) || 0;
  const otherEarnings = Number(s.otherEarnings) || 0;

  const topLevelBonus = Number(doc.bonus) || 0;
  const topLevelOvertime = Number(doc.overtimePay) || 0;

  const earnings =
    basic + hra + allowances + sBonus + sOvertime + otherEarnings +
    topLevelBonus + topLevelOvertime;

  const deductionsTotal = (doc.deductions || []).reduce(
    (acc, d) => acc + (Number(d.amount) || 0),
    0
  );

  const grossSalary = earnings;
  const netSalary = grossSalary - deductionsTotal;

  return {
    totalDeductions: Math.max(0, deductionsTotal),
    grossSalary: Math.max(0, grossSalary),
    netSalary: Math.max(0, netSalary),
  };
}

function normalizePayload(body) {
  const payload = { ...body };
  // Ensure arrays exist
  if (!Array.isArray(payload.deductions)) payload.deductions = [];
  // Coerce numeric fields (avoid strings creeping in)
  ['month', 'year', 'basicSalary', 'bonus', 'overtimePay'].forEach((k) => {
    if (payload[k] != null) payload[k] = Number(payload[k]);
  });
  if (payload.salaryStructure) {
    Object.keys(payload.salaryStructure).forEach((k) => {
      const v = payload.salaryStructure[k];
      if (v != null) payload.salaryStructure[k] = Number(v);
    });
  }
  // Recompute totals if needed
  const totals = calcTotals(payload);
  payload.totalDeductions = totals.totalDeductions;
  payload.grossSalary = totals.grossSalary;
  payload.netSalary = totals.netSalary;
  // Touch updatedAt
  payload.updatedAt = new Date();
  return payload;
}

// -------- controllers --------

// Create
exports.createPayroll = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);

    // Basic guards
    if (!payload.employeeId || !mongoose.isValidObjectId(payload.employeeId)) {
      return res.status(400).json({ error: 'Valid employeeId is required' });
    }
    if (!payload.month || payload.month < 1 || payload.month > 12) {
      return res.status(400).json({ error: 'Month must be 1-12' });
    }
    if (!payload.year) {
      return res.status(400).json({ error: 'Year is required' });
    }

    const doc = new Payroll(payload);
    const saved = await doc.save();
    return res.status(201).json(saved);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// List with filters + pagination
exports.listPayrolls = async (req, res) => {
  try {
    const {
      employeeId,
      month,
      year,
      status, // paymentStatus
      q,      // search by employeeId or transactionId
      page = 1,
      limit = 20,
      sort = 'year:desc,month:desc,createdAt:desc',
    } = req.query;

    const filter = {};
    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      filter.employeeId = employeeId;
    }
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);
    if (status) filter.paymentStatus = status;
    if (q) {
      filter.$or = [
        { transactionId: new RegExp(q, 'i') },
        ...(mongoose.isValidObjectId(q) ? [{ employeeId: q }] : []),
      ];
    }

    const sortObj = {};
    (sort || '').split(',').forEach((pair) => {
      const [k, dir = 'asc'] = pair.split(':');
      if (k) sortObj[k] = dir.toLowerCase() === 'desc' ? -1 : 1;
    });

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const skip = (p - 1) * l;

    const [items, total] = await Promise.all([
      Payroll.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(l)
        .populate({
          path: 'employeeId', select: 'employeeId userId department',
          populate: {
            path: 'userId',
            select: 'firstName lastName'
          }
        }),
      Payroll.countDocuments(filter),
    ]);

    return res.json({
      items,
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Get by ID
exports.getPayroll = async (req, res) => {
  try {
    const doc = await Payroll.findById(req.params.id)
      .populate({
        path: 'employeeId', select: 'employeeId userId',
        populate: {
          path: 'userId',
          select: 'firstName lastName department',
          populate: {
            path: 'department',
            select: 'name'
          }
        }
      });
    if (!doc) return res.status(404).json({ error: 'Payroll not found' });
    return res.json(doc);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Update (recompute totals)
exports.updatePayroll = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const updated = await Payroll.findByIdAndUpdate(
      req.params.id,
      { $set: payload },
      { new: true, runValidators: true }
    ).populate({ path: 'employeeId', select: 'employeeId userId department' });

    if (!updated) return res.status(404).json({ error: 'Payroll not found' });
    return res.json(updated);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Delete
exports.deletePayroll = async (req, res) => {
  try {
    const deleted = await Payroll.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Payroll not found' });
    return res.json({ message: 'Payroll deleted' });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Set payment status (and optional metadata)
exports.setPaymentStatus = async (req, res) => {
  try {
    const { paymentStatus, paymentMethod, transactionId, paymentDate } = req.body;
    if (!paymentStatus) {
      return res.status(400).json({ error: 'paymentStatus is required' });
    }
    const update = {
      paymentStatus,
      updatedAt: new Date(),
    };
    if (paymentMethod) update.paymentMethod = paymentMethod;
    if (transactionId) update.transactionId = transactionId;
    if (paymentDate) update.paymentDate = new Date(paymentDate);
    if (paymentStatus === 'paid' && !update.paymentDate) {
      update.paymentDate = new Date();
    }

    const doc = await Payroll.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ error: 'Payroll not found' });
    return res.json(doc);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

// Recalculate totals (useful after manual edits on deductions/salaryStructure)
exports.recalculateTotals = async (req, res) => {
  try {
    const doc = await Payroll.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Payroll not found' });

    const totals = calcTotals(doc.toObject());
    doc.totalDeductions = totals.totalDeductions;
    doc.grossSalary = totals.grossSalary;
    doc.netSalary = totals.netSalary;
    doc.updatedAt = new Date();

    const saved = await doc.save();
    return res.json(saved);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};
