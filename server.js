const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const path = require('path');
dotenv.config();

const app = express();
const userRoutes = require("./routes/user");
const eventRoutes = require("./routes/event");
const ticketRoutes = require("./routes/ticket");
const attendanceRoutes = require("./routes/attendance");
const roleRoutes = require("./routes/role");
const leaveRoutes = require("./routes/leave");
const holidayRoutes = require("./routes/holiday");
const payrollRoutes = require("./routes/payroll");
const departmentRoutes = require("./routes/department");
const employeeRoutes = require("./routes/employee");
const designationRoutes = require("./routes/designation");
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use("/api/V1/auth", userRoutes);

const PORT = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch((err) => console.error(err));
