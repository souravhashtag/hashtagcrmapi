const EODReport = require("../models/EODReport");
const emailService = require("../services/emailService");

class EODReportController {
    // ➡️ Create new report
    static async create(req, res) {
        try {
            const report = new EODReport(req.body);
            await report.save();

            // send email to HR/Admin + cc employee
            await emailService.sendEODReportNotification(report, {
                cc: [req.body.employeeEmail || ''] // if available
            });

            res.status(201).json({
                success: true,
                data: report,
                message: "Report created and emailed successfully"
            });
        } catch (error) {
            console.error("Error creating report:", error);
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // ➡️ Get all reports (with pagination option)
    // ➡️ Get all reports (Admin / HR)
    static async getAll(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const skip = (page - 1) * limit;

            const reports = await EODReport.find()
                .sort({ createdAt: -1 })
                .skip(parseInt(skip))
                .limit(parseInt(limit));

            const total = await EODReport.countDocuments();

            res.json({
                success: true,
                data: reports,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalRecords: total
                }
            });
        } catch (error) {
            console.error("Error fetching reports:", error);
            res.status(500).json({ success: false, message: "Failed to fetch reports" });
        }
    }

    // ➡️ Get all reports of a specific employee
    static async getByEmployee(req, res) {
        try {
            const { employeeName } = req.params; // using employeeName, you can also switch to employeeId
            const reports = await EODReport.find({ employeeName })
                .sort({ createdAt: -1 });

            if (!reports || reports.length === 0) {
                return res.status(404).json({ success: false, message: "No reports found for this employee" });
            }

            res.json({ success: true, data: reports });
        } catch (error) {
            console.error("Error fetching employee reports:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // ➡️ Get single report by ID
    static async getById(req, res) {
        try {
            const report = await EODReport.findById(req.params.id);
            if (!report) {
                return res.status(404).json({ success: false, message: "Report not found" });
            }
            res.json({ success: true, data: report });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // ➡️ Update a report
    static async update(req, res) {
        try {
            const report = await EODReport.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!report) {
                return res.status(404).json({ success: false, message: "Report not found" });
            }
            res.json({ success: true, data: report });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    }

    // ➡️ Delete a report
    static async delete(req, res) {
        try {
            const report = await EODReport.findByIdAndDelete(req.params.id);
            if (!report) {
                return res.status(404).json({ success: false, message: "Report not found" });
            }
            res.json({ success: true, message: "Report deleted successfully" });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = EODReportController;
