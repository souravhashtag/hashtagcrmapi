const mongoose = require('mongoose');
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
// models
const { companyDetails: CompanyDetails } = require('../models/Company'); // adjust path if different
const SalaryDeductionRule = require('../models/SalaryDeductionRule');
const Attendance = require('../models/Attendance'); // Assuming Attendance model exists; adjust path if different

/* ========= helpers ========= */

async function resolveCompanyDoc(req) {
  if (req.user?.companyId && mongoose.isValidObjectId(req.user.companyId)) {
    const doc = await CompanyDetails.findById(req.user.companyId).lean();
    if (doc) return doc;
  }
  const domain = (req.headers['x-company-domain'] || req.headers['x-tenant-domain'] || '').toString().trim().toLowerCase();
  if (domain) {
    const doc = await CompanyDetails.findOne({ domain }).lean();
    if (doc) return doc;
  }
  return await CompanyDetails.findOne({}).lean();
}

function extractCompanyPercents(company) {
  // Updated defaults to match frontend: 50% basic, 30% HRA, 20% allowances
  const out = { basic: 50, hra: 30, allowances: 20 };
  const comps = company?.settings?.payroll?.components || [];
  for (const c of comps) {
    if (!c?.isActive) continue;
    const code = String(c.code || '').toLowerCase();
    const pct = Number(c.percent) || 0;
    if (['basic', 'hra', 'allowances'].includes(code)) out[code] = pct;
  }
  return out;
}

/** MONTHLY gross from Employee based on paymentFrequency */
function getGrossFromEmployee(emp) {
  const n = (v) => Number(v) || 0;
  const amount = n(emp?.salary?.amount);
  const freq = String(emp?.salary?.paymentFrequency || 'monthly').toLowerCase();

  if (amount > 0) {
    if (freq === 'monthly') return amount;
    if (freq === 'bi-weekly') return amount * 26 / 12;
    if (freq === 'weekly') return amount * 52 / 12;
    return amount;
  }
  const annual = n(emp?.salary?.annual) || n(emp?.compensation?.ctcAnnual) || n(emp?.ctcAnnual);
  if (annual > 0) return annual / 12;
  return n(emp?.basicSalary) || 0;
}

function computeAmountForRule(rule, bases) {
  if (rule.is_applicable && Array.isArray(rule.tax_slab) && rule.tax_slab.length > 0) {
    const base = bases.gross;
    const matched = rule.tax_slab.find((s) =>
      (s.from == null || base >= Number(s.from)) &&
      (s.to == null || base <= Number(s.to))
    );
    if (matched) return Math.max(0, Number(matched.rate) || 0);
    return 0;
  }
  const { mode, fixedAmount = 0, percent = 0 } = rule.compute || {};
  if (mode === 'fixed') return Math.max(0, Number(fixedAmount) || 0);
  if (mode === 'percent_of_basic') return Math.max(0, ((Number(percent) || 0) / 100) * bases.basic);
  if (mode === 'percent_of_gross') return Math.max(0, ((Number(percent) || 0) / 100) * bases.gross);
  return 0;
}

/** Totals: keep provided gross if present */
function calcTotals(doc) {

  console.log('Calculating totals for doc:', doc);
  const s = doc.salaryStructure || {};
  const baseBasic = Number(doc.basicSalary) || 0;

  const basic = Number(s.basic ?? baseBasic) || 0;
  const hra = Number(s.hra) || 0;
  const allowances = Number(s.allowances) || 0;
  const sBonus = Number(s.bonus) || 0;
  const sOvertime = Number(s.overtime) || 0;
  const otherEarnings = Number(s.otherEarnings) || 0;

  const topLevelBonus = Number(doc.bonus) || 0;
  const topLevelOvertime = Number(doc.overtimePay) || 0;

  // ✅ If gross provided, keep it. Otherwise compute from parts.
  let grossSalary = Number(doc.grossSalary) || 0;
  if (!grossSalary) {
    grossSalary =
      basic + hra + allowances + sBonus + sOvertime + otherEarnings +
      topLevelBonus + topLevelOvertime;
  }

  const deductionsTotal = (doc.deductions || []).reduce(
    (acc, d) => acc + (Number(d.amount) || 0), 0
  );

  return {
    totalDeductions: Math.max(0, deductionsTotal),
    grossSalary: Math.max(0, grossSalary),
    netSalary: Math.max(0, grossSalary - deductionsTotal),
  };
}

function normalizePayload(body) {
  const payload = { ...body };
  if (!Array.isArray(payload.deductions)) payload.deductions = [];

  ['month', 'year', 'grossSalary', 'basicSalary', 'bonus', 'overtimePay'].forEach((k) => {
    if (payload[k] != null && payload[k] !== '') payload[k] = Number(payload[k]);
  });

  if (payload.salaryStructure) {
    Object.keys(payload.salaryStructure).forEach((k) => {
      const v = payload.salaryStructure[k];
      if (v != null && v !== '') payload.salaryStructure[k] = Number(v);
    });
  }

  const totals = calcTotals(payload);
  payload.totalDeductions = totals.totalDeductions;
  payload.netSalary = totals.netSalary;
  payload.updatedAt = new Date();
  return payload;
}


/** Build server-driven payroll (structure + deductions) - Updated to match frontend logic exactly */
async function buildServerDrivenPayroll(req, emp, month, year, activeRules) {
  const company = await resolveCompanyDoc(req);
  const percents = extractCompanyPercents(company);

  // ✅ Use employee salary.amount directly as gross (monthly equivalent)
  const gross = getGrossFromEmployee(emp);

  // Breakdown to match frontend: 50% basic, 30% HRA, remaining allowances (using company percents, but defaults match frontend)
  const basic = (gross * (percents.basic ?? 50)) / 100;
  const hra = (gross * (percents.hra ?? 30)) / 100;
  const allowances = gross - basic - hra; // Remaining, to match frontend exactly

  const salaryStructure = { basic, hra, allowances, bonus: 0, overtime: 0, otherEarnings: 0 };

  const bases = { gross, basic };

  // Rule-based deductions, matching frontend: apply all active, but skip if amount=0, special ESI handling
  const ruleDeductions = [];
  for (const r of activeRules) {
    let amount = computeAmountForRule(r, bases);
    if (r.code?.toLowerCase() === 'esi' && bases.gross >= 21000) {
      amount = 0;
    }
    if (amount > 0) {
      ruleDeductions.push({
        type: r.type,
        amount: Number(amount.toFixed(2)),
        description: r.name,
      });
    }
  }

  // LOP deduction, matching frontend exactly
  let lopDeduction = [];
  const totalDays = new Date(year, month, 0).getDate();
  if (totalDays > 0 && gross > 0) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const attendances = await Attendance.find({
      userId: emp.userId,
      date: { $gte: startDateStr, $lte: endDateStr },
    }).lean();

    const attendedDays = attendances.filter((record) => record.clockIn).length; // clockIn truthy if present
    const absentDays = totalDays - attendedDays;
    if (absentDays > 0) {
      const perDay = gross / totalDays;
      const lopAmount = absentDays * perDay;
      lopDeduction = [{
        type: 'LOP',
        amount: Number(lopAmount.toFixed(2)),
        description: `Loss of Pay for ${absentDays} absent day${absentDays !== 1 ? 's' : ''}`,
      }];
    }
  }

  const deductions = [...ruleDeductions, ...lopDeduction];

  const draft = {
    employeeId: emp._id,
    month, year,
    grossSalary: gross,            // <-- always keep the actual salary.amount (monthly)
    salaryStructure,
    deductions,
    bonus: 0,
    overtimePay: 0,
    paymentStatus: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Totals: keep gross as-is, only compute net
  const totals = calcTotals(draft);
  draft.totalDeductions = totals.totalDeductions;
  draft.netSalary = totals.netSalary;

  return draft;
}



async function resolveEmployeeId(req) {
  // If middleware already added employeeId
  // if (req.user?.employeeId && mongoose.isValidObjectId(req.user.employeeId)) {
  //   return req.user.employeeId;
  // }

  // If user object is available, search Employee by userId
  if (req.user?.id && mongoose.isValidObjectId(req.user.id)) {
    const emp = await Employee.findOne({ userId: req.user.id }).select('_id');
    if (emp) {
      return emp._id.toString();
    }
  }

  return null; // not found
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
      q,      // search by employeeId, transactionId, or employee name
      page = 1,
      limit = 20,
      sort = 'year:desc,month:desc,createdAt:desc',
    } = req.query;

    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    const skip = (p - 1) * l;

    const match = {};
    if (employeeId && mongoose.isValidObjectId(employeeId)) {
      match.employeeId = new mongoose.Types.ObjectId(employeeId);
    }
    if (month) match.month = Number(month);
    if (year) match.year = Number(year);
    if (status) match.paymentStatus = status;

    // Build sort object
    const sortObj = {};
    (sort || '').split(',').forEach((pair) => {
      const [k, dir = 'asc'] = pair.split(':');
      if (k) sortObj[k] = dir.toLowerCase() === 'desc' ? -1 : 1;
    });

    // Aggregation with lookup to users
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'employees',
          localField: 'employeeId',
          foreignField: '_id',
          as: 'employeeId',
          pipeline: [
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userId',
              },
            },
            { $unwind: { path: '$userId', preserveNullAndEmptyArrays: true } },
          ],
        },
      },
      { $unwind: { path: '$employeeId', preserveNullAndEmptyArrays: true } },
    ];

    // Search filter (transactionId, employeeId, or employee name)
    if (q) {
      const regex = new RegExp(q, 'i');
      pipeline.push({
        $match: {
          $or: [
            { transactionId: regex },
            { 'employeeId.employeeId': regex },
            { 'employeeId.userId.firstName': regex },
            { 'employeeId.userId.lastName': regex },
            ...(mongoose.isValidObjectId(q) ? [{ employeeId: new mongoose.Types.ObjectId(q) }] : []),
          ],
        },
      });
    }

    pipeline.push({ $sort: sortObj });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: l });

    // Count total separately
    const [items, total] = await Promise.all([
      Payroll.aggregate(pipeline),
      Payroll.countDocuments(match),
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


/**
 * GET /api/payrolls/my
 * Return only the authenticated employee's payrolls
 * Supports same query params as listPayrolls: month, year, status, q, page, limit, sort
 */
exports.listMyPayrolls = async (req, res) => {
  try {
    const empId = await resolveEmployeeId(req);
    if (!empId) {
      return res.status(403).json({ error: 'Employee profile not found for current user' });
    }


    console.log('Employee ID:', empId);

    const {
      month,
      year,
      status, // paymentStatus
      q,      // search by transactionId (employeeId is fixed to current user)
      page = 1,
      limit = 20,
      sort = 'year:desc,month:desc,createdAt:desc',
    } = req.query;

    const filter = { employeeId: empId };
    if (month) filter.month = Number(month);
    if (year) filter.year = Number(year);
    if (status) filter.paymentStatus = status;
    if (q) {
      filter.$or = [
        { transactionId: new RegExp(q, 'i') },
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
          path: 'employeeId',
          select: 'employeeId userId',
          populate: { path: 'userId', select: 'firstName lastName department', populate: { path: 'department', select: 'name' }, },
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

/**
 * GET /api/payrolls/my/:id
 * Fetch a single payroll by id, but only if it belongs to the current employee
 */
exports.getMyPayroll = async (req, res) => {
  try {
    const empId = await resolveEmployeeId(req);
    if (!empId) {
      return res.status(403).json({ error: 'Employee profile not found for current user' });
    }

    const doc = await Payroll.findOne({ _id: req.params.id, employeeId: empId })
      .populate({
        path: 'employeeId',
        select: 'employeeId userId',
        populate: {
          path: 'userId',
          select: 'firstName lastName department',
          populate: { path: 'department', select: 'name' },
        },
      });

    if (!doc) return res.status(404).json({ error: 'Payroll not found' });
    return res.json(doc);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};



// Generate auto payslip URL (stub implementation)
/**
 * POST /api/payrolls/generate
 * Body/Query: { month?: 1-12, year?: 4-digit, includeExisting?: 'refresh' | 'skip' }
 *  - If includeExisting === 'refresh', we recompute totals for already-existing docs
 *    using their current fields (useful if deduction rules or structure changed).
 *  - Default behavior is 'skip' (don't touch existing docs).
 * 
 * This endpoint can be called manually or triggered automatically (e.g., via cron job at the start of every month).
 * For auto-generation at start of month, set up a cron job like: 0 0 1 * * node /path/to/script-that-calls-this-endpoint-with-current-month-year
 */
exports.generateForAllEmployees = async (req, res) => {
  try {
    const now = new Date();
    const month = Number(req.body.month ?? req.query.month ?? (now.getMonth() + 1));
    const year = Number(req.body.year ?? req.query.year ?? now.getFullYear());
    const includeExisting = (req.body.includeExisting ?? req.query.includeExisting ?? 'skip').toString();

    if (!month || month < 1 || month > 12) return res.status(400).json({ error: 'Month must be 1-12' });
    if (!year) return res.status(400).json({ error: 'Year is required' });

    const [employees, activeRules] = await Promise.all([
      Employee.find(
        {},
        {
          _id: 1,
          userId: 1,
          'salary.amount': 1,
          'salary.paymentFrequency': 1,
          'salary.annual': 1,
          'salary.gross': 1,
          compensation: 1,
          ctcMonthly: 1,
          ctcAnnual: 1,
          basicSalary: 1,
        }
      ).lean(),
      SalaryDeductionRule.find({ active: true }).lean(),
    ]);


    let created = 0, skipped = 0, refreshed = 0;
    const results = [];

    for (const emp of employees) {
      const preGross = getGrossFromEmployee(emp);

      if (preGross <= 0) { // skip employees without salary configured
        results.push({ employeeId: emp._id, action: 'skipped_no_salary' });
        continue;
      }

      const existing = await Payroll.findOne({ employeeId: emp._id, month, year });

      if (existing) {
        if (includeExisting === 'refresh') {
          const rebuilt = await buildServerDrivenPayroll(req, emp, month, year, activeRules);
          existing.salaryStructure = rebuilt.salaryStructure;
          existing.deductions = rebuilt.deductions;

          const totals = calcTotals(existing.toObject());
          existing.totalDeductions = totals.totalDeductions;
          existing.netSalary = totals.netSalary;
          existing.updatedAt = new Date();
          await existing.save();

          refreshed++;
          results.push({ employeeId: emp._id, payrollId: existing._id, action: 'refreshed' });
        } else {
          skipped++;
          results.push({ employeeId: emp._id, payrollId: existing._id, action: 'skipped' });
        }
        continue;
      }

      const payload = await buildServerDrivenPayroll(req, emp, month, year, activeRules);
      const createdDoc = await Payroll.create(payload);
      created++;
      results.push({ employeeId: emp._id, payrollId: createdDoc._id, action: 'created' });
    }

    return res.json({
      month,
      year,
      summary: { created, refreshed, skipped, totalEmployees: employees.length },
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};