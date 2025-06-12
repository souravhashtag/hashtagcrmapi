const Department = require('../models/Department');
const User = require('../models/User');

class DepartmentController {
  static async createDepartment(req, res) {
    try {
      const { name, description } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Department name is required'
        });
      }

      const existingDepartment = await Department.findOne({ 
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
      });

      if (existingDepartment) {
        return res.status(400).json({
          success: false,
          message: 'Department with this name already exists'
        });
      }

      const departmentData = {
        name: name.trim(),
        description: description?.trim() || ''
      };

      const department = new Department(departmentData);
      const savedDepartment = await department.save();

      res.status(201).json({
        success: true,
        data: savedDepartment,
        message: 'Department created successfully'
      });
    } catch (error) {
      console.error('Error creating department:', error);

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Department name already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create department',
        error: error.message
      });
    }
  }

  static  getAllDepartments = async(req, res) =>{
    try {
      const { page = 1, limit = 10, search, sortBy = 'name', sortOrder = 'asc' } = req.query;
      const skip = (page - 1) * limit;

      let query = {};
      if (search && search.trim() !== '') {
        const regex = new RegExp(search.trim(), 'i');
        query = {
          $or: [
            { name: regex },
            { description: regex }
          ]
        };
      }

      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      let departments = await Department.find(query)        
        .sort(sortObj)
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('employeeCount');;
      
        // departments = departments?.map((val)=>{
        //   val.employeeCount =  User.countDocuments({ department: val._id });
        // })
      
      const total = await Department.countDocuments(query);

      res.status(200).json({
        success: true,
        data: departments,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          per_page: parseInt(limit),
          has_next: page < Math.ceil(total / limit),
          has_prev: page > 1
        }
      });
    } catch (error) {
      console.error('Error fetching departments:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching departments',
        error: error.message
      });
    }
  }

  static async getDepartmentById(req, res) {
    try {
      const { id } = req.params;      

      const department = await Department.findById(id);

      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      res.status(200).json({
        success: true,
        data: department
      });
    } catch (error) {
      console.error('Error fetching department:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching department',
        error: error.message
      });
    }
  }

  static async updateDepartment(req, res) {
    try {
      const { id } = req.params;
      const { name, description } = req.body;      

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Department name is required'
        });
      }

      const existingDepartment = await Department.findOne({
        name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
        _id: { $ne: id }
      });

      if (existingDepartment) {
        return res.status(400).json({
          success: false,
          message: 'Another department with this name already exists'
        });
      }

      // Prepare update data
      const updateData = {
        name: name.trim(),
        description: description?.trim() || '',
        updatedAt: new Date()
      };

      // Update department
      const updatedDepartment = await Department.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true
        }
      );

      if (!updatedDepartment) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      res.status(200).json({
        success: true,
        data: updatedDepartment,
        message: 'Department updated successfully'
      });
    } catch (error) {
      console.error('Error updating department:', error);

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
        return res.status(400).json({
          success: false,
          message: 'Department name already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update department',
        error: error.message
      });
    }
  }

  static async deleteDepartment(req, res) {
    try {
      const { id } = req.params;
      const department = await Department.findById(id);
      if (!department) {
        return res.status(404).json({
          success: false,
          message: 'Department not found'
        });
      }

      await Department.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Department deleted successfully',
        data: { deletedDepartment: department }
      });
    } catch (error) {
      console.error('Error deleting department:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete department',
        error: error.message
      });
    }
  }

  static async getDepartmentStats(req, res) {
    try {
      const totalDepartments = await Department.countDocuments();
      
      const departmentStats = await Department.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: 'department',
            as: 'users'
          }
        },
        {
          $project: {
            name: 1,
            description: 1,
            employeeCount: { $size: '$users' },
            createdAt: 1
          }
        },
        {
          $sort: { employeeCount: -1 }
        }
      ]);

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentDepartments = await Department.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });

      res.status(200).json({
        success: true,
        data: {
          totalDepartments,
          recentDepartments,
          departmentStats
        }
      });
    } catch (error) {
      console.error('Error fetching department statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching department statistics',
        error: error.message
      });
    }
  }

  static async bulkCreateDepartments(req, res) {
    try {
      const { departments } = req.body;

      if (!Array.isArray(departments) || departments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Departments array is required and cannot be empty'
        });
      }

      for (let i = 0; i < departments.length; i++) {
        const dept = departments[i];
        if (!dept.name || dept.name.trim() === '') {
          return res.status(400).json({
            success: false,
            message: `Department name is required for item at index ${i}`
          });
        }
      }

      const processedDepartments = departments.map(dept => ({
        name: dept.name.trim(),
        description: dept.description?.trim() || ''
      }));

      const savedDepartments = await Department.insertMany(processedDepartments, {
        ordered: false 
      });

      res.status(201).json({
        success: true,
        data: savedDepartments,
        message: `Successfully created ${savedDepartments.length} departments`
      });
    } catch (error) {
      console.error('Error bulk creating departments:', error);

      // Handle bulk write errors
      if (error.name === 'BulkWriteError') {
        const successfulInserts = error.result.insertedCount || 0;
        const duplicateErrors = error.writeErrors?.filter(err => err.code === 11000) || [];
        
        return res.status(207).json({
          success: true,
          message: `Created ${successfulInserts} departments. ${duplicateErrors.length} duplicates skipped.`,
          data: {
            created: successfulInserts,
            duplicates: duplicateErrors.length,
            errors: duplicateErrors.map(err => err.errmsg)
          }
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create departments',
        error: error.message
      });
    }
  }

  static async searchDepartments(req, res) {
    try {
      const { 
        q,
        minEmployees, 
        maxEmployees,
        createdAfter,
        createdBefore,
        sortBy = 'name',
        sortOrder = 'asc',
        page = 1,
        limit = 10
      } = req.query;

      const skip = (page - 1) * limit;
      let pipeline = [];

      let matchStage = {};
      
      if (q && q.trim() !== '') {
        const regex = new RegExp(q.trim(), 'i');
        matchStage.$or = [
          { name: regex },
          { description: regex }
        ];
      }

      if (createdAfter || createdBefore) {
        matchStage.createdAt = {};
        if (createdAfter) matchStage.createdAt.$gte = new Date(createdAfter);
        if (createdBefore) matchStage.createdAt.$lte = new Date(createdBefore);
      }

      pipeline.push({ $match: matchStage });

      pipeline.push({
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'department',
          as: 'employees'
        }
      });

      pipeline.push({
        $addFields: {
          employeeCount: { $size: '$employees' }
        }
      });

      if (minEmployees || maxEmployees) {
        let employeeFilter = {};
        if (minEmployees) employeeFilter.$gte = parseInt(minEmployees);
        if (maxEmployees) employeeFilter.$lte = parseInt(maxEmployees);
        pipeline.push({
          $match: { employeeCount: employeeFilter }
        });
      }

      pipeline.push({
        $project: {
          employees: 0
        }
      });

      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      pipeline.push({ $sort: sortObj });

      const countPipeline = [...pipeline, { $count: "total" }];
      const countResult = await Department.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;

      pipeline.push({ $skip: parseInt(skip) });
      pipeline.push({ $limit: parseInt(limit) });

      const departments = await Department.aggregate(pipeline);

      res.status(200).json({
        success: true,
        data: departments,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          per_page: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error searching departments:', error);
      res.status(500).json({
        success: false,
        message: 'Error searching departments',
        error: error.message
      });
    }
  }
}

module.exports = DepartmentController;