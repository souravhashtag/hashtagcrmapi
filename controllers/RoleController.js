const Role = require('../models/Role'); 

class RoleController {

  static  createRole = async(req, res) => {
    try {
      const { name, display_name, description, menulist } = req.body;

      // Check if role with same name already exists
      const existingRole = await Role.findOne({ name });
      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: 'Role with this name already exists'
        });
      }

      const role = new Role({
        name,
        display_name,
        description,
        menulist
      });

      const savedRole = await role.save();
      
      res.status(201).json({
        success: true,
        message: 'Role created successfully',
        data: savedRole
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error creating role',
        error: error.message
      });
    }
  }


  static getAllRoles = async(req, res) => {
    try {
      const { page = 1, limit = 10, search } = req.query;
      const skip = (page - 1) * limit;

      let query = {};
      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { display_name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          ]
        };
      }

      const roles = await Role.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Role.countDocuments(query);
      //console.log(total);
      res.status(200).json({
        success: true,
        data: roles,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          per_page: parseInt(limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching roles',
        error: error.message
      });
    }
  }


  static getRoleById = async(req, res) => {
    try {
      const { id } = req.params;
      
      const role = await Role.findById(id);
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      res.status(200).json({
        success: true,
        data: role
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role',
        error: error.message
      });
    }
  }


  static updateRole = async(req, res) => {
    try {
      const { id } = req.params;
      const { name, display_name, description, menulist } = req.body;

      // Check if role exists
      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Check if name is being changed and if new name already exists
      if (name && name !== role.name) {
        const existingRole = await Role.findOne({ name, _id: { $ne: id } });
        if (existingRole) {
          return res.status(400).json({
            success: false,
            message: 'Role with this name already exists'
          });
        }
      }

      const updatedRole = await Role.findByIdAndUpdate(
        id,
        {
          name,
          display_name,
          description,
          menulist
        },
        { new: true, runValidators: true }
      );

      res.status(200).json({
        success: true,
        message: 'Role updated successfully',
        data: updatedRole
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating role',
        error: error.message
      });
    }
  }

  static deleteRole = async(req, res) => {
    try {
      const { id } = req.params;

      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      await Role.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Role deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting role',
        error: error.message
      });
    }
  }

  static deleteMultipleRoles = async(req, res) => {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of role IDs'
        });
      }

      const result = await Role.deleteMany({ _id: { $in: ids } });

      res.status(200).json({
        success: true,
        message: `${result.deletedCount} roles deleted successfully`,
        deleted_count: result.deletedCount
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error deleting roles',
        error: error.message
      });
    }
  }

  static searchRolesByName = async(req, res) => {
    try {
      const { name } = req.query;

      if (!name) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a name to search'
        });
      }

      const roles = await Role.find({
        name: { $regex: name, $options: 'i' }
      }).sort({ name: 1 });

      res.status(200).json({
        success: true,
        data: roles,
        count: roles.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error searching roles',
        error: error.message
      });
    }
  }
}

module.exports = RoleController;