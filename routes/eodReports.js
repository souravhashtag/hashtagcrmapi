const express = require("express");
const router = express.Router();
const EODReportController = require("../controllers/EODReportController");

// CRUD routes
router.post("/", EODReportController.create);
router.get("/", EODReportController.getAll);
// Employee route → fetch all reports by employee (by name or ID)
router.get("/:employeeName", EODReportController.getByEmployee);
router.get("/:id", EODReportController.getById);
router.put("/:id", EODReportController.update);
router.delete("/:id", EODReportController.delete);

module.exports = router;
