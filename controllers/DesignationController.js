const Designation = require('../models/Designation');
const Department = require('../models/Department'); // Assuming you have Department model
const { validationResult } = require('express-validator');

class DesignationController {

  async getAllDesignations(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        search = '', 
        department = '', 
        status = '' 
      } = req.query;

      const query = {};
      
      // Search functionality
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Filter by department
      if (department) {
        query.department = department;
      }
      
      // Filter by status
      if (status !== '') {
        query.isActive = status === 'true';
      }

      const skip = (page - 1) * limit;
      
      const [designations, totalCount] = await Promise.all([
        Designation.find(query)
          .populate('department', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Designation.countDocuments(query)
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      res.status(200).json({
        success: true,
        message: 'Designations retrieved successfully',
        data: designations,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalCount,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });

    } catch (error) {
      console.error('Error fetching designations:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch designations',
        error: error.message
      });
    }
  }

  /**
   * Get designation by ID
   * GET /api/designations/:id
   */
  async getDesignationById(req, res) {
    try {
      const { id } = req.params;

      const designation = await Designation.findById(id)
        .populate('department', 'name description');

      if (!designation) {
        return res.status(404).json({
          success: false,
          message: 'Designation not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Designation retrieved successfully',
        data: designation
      });

    } catch (error) {
      console.error('Error fetching designation:', error);
      
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid designation ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to fetch designation',
        error: error.message
      });
    }
  }

  /**
   * Create new designation
   * POST /api/designations
   */
  async createDesignation(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { title, department, description, isActive } = req.body;

      // Check if title already exists
      const existingDesignation = await Designation.findOne({ 
        title: { $regex: new RegExp(`^${title}$`, 'i') }
      });

      if (existingDesignation) {
        return res.status(400).json({
          success: false,
          message: 'Designation with this title already exists'
        });
      }

      // Verify department exists if provided
      if (department) {
        const departmentExists = await Department.findById(department);
        if (!departmentExists) {
          return res.status(400).json({
            success: false,
            message: 'Department not found'
          });
        }
      }

      const designation = new Designation({
        title,
        department: department || null,
        description,
        isActive: isActive !== undefined ? isActive : true
      });

      const savedDesignation = await designation.save();
      
      // Populate department data in response
      await savedDesignation.populate('department', 'name');

      res.status(201).json({
        success: true,
        message: 'Designation created successfully',
        data: savedDesignation
      });

    } catch (error) {
      console.error('Error creating designation:', error);

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Designation with this title already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to create designation',
        error: error.message
      });
    }
  }

  /**
   * Update designation
   * PUT /api/designations/:id
   */
  async updateDesignation(req, res) {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const { title, department, description, isActive } = req.body;

      // Check if designation exists
      const existingDesignation = await Designation.findById(id);
      if (!existingDesignation) {
        return res.status(404).json({
          success: false,
          message: 'Designation not found'
        });
      }

      // Check if title already exists (excluding current designation)
      if (title && title !== existingDesignation.title) {
        const duplicateTitle = await Designation.findOne({
          title: { $regex: new RegExp(`^${title}$`, 'i') },
          _id: { $ne: id }
        });

        if (duplicateTitle) {
          return res.status(400).json({
            success: false,
            message: 'Designation with this title already exists'
          });
        }
      }

      // Verify department exists if provided
      if (department) {
        const departmentExists = await Department.findById(department);
        if (!departmentExists) {
          return res.status(400).json({
            success: false,
            message: 'Department not found'
          });
        }
      }

      const updateData = {};
      if (title !== undefined) updateData.title = title;
      if (department !== undefined) updateData.department = department;
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const updatedDesignation = await Designation.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).populate('department', 'name');

      res.status(200).json({
        success: true,
        message: 'Designation updated successfully',
        data: updatedDesignation
      });

    } catch (error) {
      console.error('Error updating designation:', error);

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid designation ID'
        });
      }

      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Designation with this title already exists'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update designation',
        error: error.message
      });
    }
  }

  /**
   * Delete designation (soft delete)
   * DELETE /api/designations/:id
   */
  async deleteDesignation(req, res) {
    try {
      const { id } = req.params;
      const { permanent = false } = req.query;

      const designation = await Designation.findById(id);
      if (!designation) {
        return res.status(404).json({
          success: false,
          message: 'Designation not found'
        });
      }

      if (permanent === 'true') {
        // Permanent delete
        await Designation.findByIdAndDelete(id);
        
        res.status(200).json({
          success: true,
          message: 'Designation permanently deleted'
        });
      } else {
        // Soft delete - mark as inactive
        const updatedDesignation = await Designation.findByIdAndUpdate(
          id,
          { isActive: false },
          { new: true }
        ).populate('department', 'name');

        res.status(200).json({
          success: true,
          message: 'Designation deactivated successfully',
          data: updatedDesignation
        });
      }

    } catch (error) {
      console.error('Error deleting designation:', error);

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid designation ID'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to delete designation',
        error: error.message
      });
    }
  }

  /**
   * Bulk operations
   * POST /api/designations/bulk
   */
  async bulkOperations(req, res) {
    try {
      const { operation, ids, data } = req.body;

      if (!operation || !ids || !Array.isArray(ids)) {
        return res.status(400).json({
          success: false,
          message: 'Operation and ids array are required'
        });
      }

      let result;

      switch (operation) {
        case 'activate':
          result = await Designation.updateMany(
            { _id: { $in: ids } },
            { isActive: true }
          );
          break;

        case 'deactivate':
          result = await Designation.updateMany(
            { _id: { $in: ids } },
            { isActive: false }
          );
          break;

        case 'delete':
          result = await Designation.deleteMany({ _id: { $in: ids } });
          break;

        case 'update':
          if (!data) {
            return res.status(400).json({
              success: false,
              message: 'Update data is required'
            });
          }
          result = await Designation.updateMany(
            { _id: { $in: ids } },
            data
          );
          break;

        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid operation'
          });
      }

      res.status(200).json({
        success: true,
        message: `Bulk ${operation} completed successfully`,
        affected: result.modifiedCount || result.deletedCount,
        result
      });

    } catch (error) {
      console.error('Error in bulk operation:', error);
      res.status(500).json({
        success: false,
        message: 'Bulk operation failed',
        error: error.message
      });
    }
  }

  /**
   * Get designations by department
   * GET /api/designations/department/:departmentId
   */
  async getDesignationsByDepartment(req, res) {
    try {
      const { departmentId } = req.params;
      const { activeOnly = 'true' } = req.query;

      const query = { department: departmentId };
      if (activeOnly === 'true') {
        query.isActive = true;
      }

      const designations = await Designation.find(query)
        .populate('department', 'name')
        .sort({ title: 1 });

      res.status(200).json({
        success: true,
        message: 'Designations retrieved successfully',
        data: designations,
        count: designations.length
      });

    } catch (error) {
      console.error('Error fetching designations by department:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch designations',
        error: error.message
      });
    }
  }

  /**
   * Toggle designation status
   * PATCH /api/designations/:id/toggle-status
   */
  async toggleStatus(req, res) {
    try {
      const { id } = req.params;

      const designation = await Designation.findById(id);
      if (!designation) {
        return res.status(404).json({
          success: false,
          message: 'Designation not found'
        });
      }

      designation.isActive = !designation.isActive;
      const updatedDesignation = await designation.save();
      
      await updatedDesignation.populate('department', 'name');

      res.status(200).json({
        success: true,
        message: `Designation ${updatedDesignation.isActive ? 'activated' : 'deactivated'} successfully`,
        data: updatedDesignation
      });

    } catch (error) {
      console.error('Error toggling designation status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle designation status',
        error: error.message
      });
    }
  }
}

module.exports = new DesignationController();