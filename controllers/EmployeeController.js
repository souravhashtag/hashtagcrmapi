const Employee = require('../models/Employee');
const User = require('../models/User');
const bcrypt = require('bcrypt');
class EmployeeController {
  static async createEmployee(req, res) {
    try {
      const { userDatast, employeeDatast } = req.body;      
      let userData = JSON.parse(userDatast) || {};
      let employeeData = JSON.parse(employeeDatast) || {};
      if (userData) {        
        if (!userData.password) {
            throw new Error('Password is required');
        }
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);        
        const userObj = {
          email: userData.email,
          password: hashedPassword,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          role: userData.roleId || userData.role,
          department: userData.departmentId || userData.department,
          position: userData.position,
          status: userData.status || 'active'
        };
        
        const existingUser = await User.findOne({ email: userData.email });
        if (existingUser) {
          return res.status(400).json({ 
            success: false, 
            message: 'User with this email already exists' 
          });
        }
        
        const user = new User(userObj);
        const savedUser = await user.save();
        
        employeeData.userId = savedUser._id;
      }

      if (employeeData.userId) {
        const existingEmployee = await Employee.findOne({ userId: employeeData.userId });
        if (existingEmployee) {
          return res.status(400).json({ 
            success: false, 
            message: 'Employee ID already exists' 
          });
        }
      }
      
      const employee = new Employee(employeeData);
      const savedEmployee = await employee.save();
      
      await savedEmployee.populate('userId');
      
      res.status(201).json({ 
        success: true, 
        data: savedEmployee,
        message: 'Employee created successfully'
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ 
          success: false, 
          message: 'Validation failed', 
          errors: validationErrors 
        });
      }
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({ 
          success: false, 
          message: `${field} already exists` 
        });
      }
      
      res.status(400).json({ 
        success: false, 
        message: 'Failed to create employee', 
        error: error.message 
      });
    }
  }

  static async getAllEmployees(req, res) {
    try {
      const { page = 1, limit = 10, search, status, department, role } = req.query;
      const skip = (page - 1) * limit;

      let query = {};
      
      if (search) {
        const regex = new RegExp(search, 'i');
        query = {
          $or: [
            { employeeId: regex },
            { 'emergencyContact.name': regex },
            { 'bankDetails.bankName': regex }
          ]
        };
      }

      const employees = await Employee.find(query)
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate({
          path: 'userId',
          populate: [
            { 
              path: 'role', 
              select: 'name display_name',
              model: 'Role'
            },
            { 
              path: 'department', 
              select: 'name description',
              model: 'Department'
            }
          ]
        })
        .populate({
          path: 'performanceReviews.reviewerId',
          select: 'firstName lastName',
          model: 'User'
        })
        .sort({ createdAt: -1 });

      let filteredEmployees = employees;
      
      if (status) {
        filteredEmployees = employees.filter(emp => emp.userId?.status === status);
      }
      
      if (department) {
        filteredEmployees = employees.filter(emp => emp.userId?.department?._id.toString() === department);
      }
      
      if (role) {
        filteredEmployees = employees.filter(emp => emp.userId?.role?._id.toString() === role);
      }

      const total = await Employee.countDocuments(query);
      
    filteredEmployees = filteredEmployees.map(emp => {
      if (emp.userId && emp.userId.profilePicture) {
        const baseUrl = process.env.FRONT_BASE_URL || 'http://localhost:5000';
          emp.userId.profilePicture = `${baseUrl}/${emp.userId.profilePicture}`;        
      }
      return emp; 
    });
      res.status(200).json({
        success: true,
        data: filteredEmployees,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          per_page: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching employees', 
        error: error.message 
      });
    }
  }
  static async getBirthdayList(req, res) {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; 
      const currentDay = currentDate.getDate();
      //console.log(currentDate)
      const employees = await Employee.find({})
        .populate({
          path: 'userId',
          match: { status: 'active' }, 
          select: 'firstName lastName profilePicture status'
        })
        .select('dob userId')
        .lean();

      const activeEmployees = employees.filter(emp => emp.userId !== null);

      const todayBirthdays = [];
      const thisMonthBirthdays = [];

      activeEmployees.forEach(employee => {
        if (employee.dob && employee.userId) {
          const birthDate = new Date(employee.dob);
          const birthMonth = birthDate.getMonth() + 1;
          const birthDay = birthDate.getDate();
          let image = '';
          if(employee?.userId?.profilePicture){
             image = `${process.env.FRONT_BASE_URL}/${employee?.userId?.profilePicture}`;
          }
          const employeeData = {
            name: `${employee.userId.firstName} ${employee.userId.lastName}`,
            image: image || '', 
            date: new Date(employee.dob).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).replace(' ', ', ') 
          };

          // Check if birthday is today
          if (birthMonth === currentMonth && birthDay === currentDay) {
            todayBirthdays.push({  ...employeeData ,header: "Today's Birthday"});
          }

          // Check if birthday is in current month (excluding today to avoid duplicates)
          if ((birthMonth === currentMonth || birthMonth+1 === currentMonth+1) && birthDay > currentDay) {
            thisMonthBirthdays.push({  ...employeeData ,header: "Celebrating Soon"});
          }
        }
      });

      // Sort by date
      todayBirthdays.sort((a, b) => new Date(a.date) - new Date(b.date));
      thisMonthBirthdays.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Format response as requested
      const response = [
        {
          todaybirthday: todayBirthdays
        },
        {
          thismonth: thisMonthBirthdays
        }
      ];

      res.status(200).json({
        success: true,
        data: response
      });

    } catch (error) {
      console.error('Error fetching birthday list:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching birthday list',
        error: error.message
      });
    }
  }

  static async getEmployeeById(req, res) {
    try {
      const { id } = req.params;      
      // First, get the employee with basic user population
      let employee = await Employee.findById(id).populate('userId');

      if (!employee) {
        return res.status(404).json({ 
          success: false, 
          message: 'Employee not found' 
        });
      }

      // Then manually populate role and department
      if (employee.userId) {
        await employee.populate({
          path: 'userId.role',
          select: 'name display_name permissions'
        });
        
        await employee.populate({
          path: 'userId.department', 
          select: 'name description'
        });
      }

      await employee.populate({
        path: 'performanceReviews.reviewerId',
        select: 'firstName lastName email'
      });

      // console.log('Employee userId:', employee.userId?._id);
      // console.log('Employee department:', employee.userId?.department);
      // console.log('Employee role:', employee.userId?.role);

      res.status(200).json({ 
        success: true, 
        data: employee 
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching employee', 
        error: error.message 
      });
    }
  }

  static async updateEmployee(req, res) {
    try {
      const { id } = req.params;
      const { userDatast, employeeDatast } = req.body;

      let userData = JSON.parse(userDatast) || {};
      let employeeData = JSON.parse(employeeDatast) || {};
      const existingEmployee = await Employee.findById(id);
      if (!existingEmployee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // Handle profile picture upload
      let documentUrls = [];
      let profilePictureUrl = null;
      
      // console.log('Files received:', userData);return
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const profilePictures = req.files.filter(file => file.fieldname === 'profilePicture');
        if (profilePictures.length > 0) {
          profilePictureUrl = profilePictures[0].path || profilePictures[0].filename;
        }
        const documentsFiles = req.files.filter(file => file.fieldname === 'documents[]');
        
        if (documentsFiles.length > 0) {
          documentUrls = documentsFiles.map((file, index) => {
            const metadata = employeeData.documents && employeeData.documents[index] 
              ? employeeData.documents[index] 
              : { type: 'other', name: file.originalname };

            return {
              url: file.path || file.filename,
              type: metadata.type,
              name: metadata.name || file.originalname,
              uploadedAt: new Date()
            };
          });
        }
      }
      // console.log('Documents uploaded:', employeeData);
      // Update user data if provided
      if (userData && existingEmployee.userId) {
        const userUpdateData = { ...userData };
        
        // Add profile picture to user data if uploaded
        if (profilePictureUrl) {
          userUpdateData.profilePicture = profilePictureUrl;
        }

        // Hash password if provided
        if (userData.password) {
          const saltRounds = 10;
          userUpdateData.password = await bcrypt.hash(userData.password, saltRounds);
        }

        // Handle role and department fields
        if (userData.roleId) {
          userUpdateData.role = userData.roleId;
          delete userUpdateData.roleId;
        }
        if (userData.departmentId) {
          userUpdateData.department = userData.departmentId;
          delete userUpdateData.departmentId;
        }

        // Check for duplicate email (excluding current user)
        if (userData.email) {
          const existingUser = await User.findOne({
            email: userData.email,
            _id: { $ne: existingEmployee.userId }
          });
          if (existingUser) {
            return res.status(400).json({
              success: false,
              message: 'Email already exists for another user'
            });
          }
        }

        await User.findByIdAndUpdate(existingEmployee.userId, userUpdateData, {
          new: true,
          runValidators: true
        });
      } else if (profilePictureUrl && existingEmployee.userId) {
        // If only profile picture is being updated (no other userData)
        await User.findByIdAndUpdate(existingEmployee.userId, { 
          profilePicture: profilePictureUrl 
        }, {
          new: true,
          runValidators: true
        });
      }
      if (documentUrls.length > 0) {
        employeeData.documents = [...(existingEmployee.documents || []), ...documentUrls];
      }
      // Check for duplicate employee ID (excluding current employee)
      if (employeeData.employeeId && employeeData.employeeId !== existingEmployee.employeeId) {
        const existingEmpId = await Employee.findOne({
          employeeId: employeeData.employeeId,
          _id: { $ne: id }
        });
        if (existingEmpId) {
          return res.status(400).json({
            success: false,
            message: 'Employee ID already exists'
          });
        }
      }
      // console.log('Updating employee with data:', employeeData);return
      // Update employee data
      const updatedEmployee = await Employee.findByIdAndUpdate(id, employeeData, {
        new: true,
        runValidators: true
      }).populate({
        path: 'userId',
        populate: [
          { path: 'role', select: 'name display_name' },
          { path: 'department', select: 'name' }
        ]
      }).populate('performanceReviews.reviewerId', 'firstName lastName');

      res.status(200).json({
        success: true,
        data: updatedEmployee,
        message: profilePictureUrl ? 
          'Employee and profile picture updated successfully' : 
          'Employee updated successfully',
        profilePictureUrl: profilePictureUrl // Include the new image URL in response
      });

    } catch (error) {
      console.error('Error updating employee:', error);

      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      // Handle duplicate key errors
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `${field} already exists`
        });
      }

      res.status(400).json({
        success: false,
        message: 'Failed to update employee',
        error: error.message
      });
    }
  }

  static async deleteEmployee(req, res) {
    try {
      const { id } = req.params;
      
      const employee = await Employee.findById(id);
      if (!employee) {
        return res.status(404).json({ 
          success: false, 
          message: 'Employee not found' 
        });
      }

      // Delete associated user if exists
      if (employee.userId) {
        await User.findByIdAndDelete(employee.userId);
      }

      // Delete employee
      await Employee.findByIdAndDelete(id);

      res.status(200).json({ 
        success: true, 
        message: 'Employee and associated user deleted successfully' 
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to delete employee', 
        error: error.message 
      });
    }
  }
  static async getEmployeeProfileById(req, res) {
    try {
      
      const employee = await Employee.findOne({ userId: req?.user?.id })
        .select('_id employeeId joiningDate dob') 
        .populate({
          path: 'userId',
          select: 'firstName lastName email phone profilePicture' 
        }).lean(); 

        employee.user = employee.userId;
        delete employee.userId;
      if (!employee) {
        return res.status(404).json({ 
          success: false, 
          message: 'Employee not found' 
        });
      }
      if (employee.user && employee.user.profilePicture) {
        const baseUrl = process.env.FRONT_BASE_URL || 'http://localhost:5000';          
          employee.user.profilePicture = `${baseUrl}/${employee.user.profilePicture}`;        
      }
      res.status(200).json({ 
        success: true, 
        data: employee 
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching employee', 
        error: error.message 
      });
    }
  }
}

module.exports = EmployeeController;
