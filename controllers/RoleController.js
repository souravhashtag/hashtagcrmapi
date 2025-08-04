const Role = require('../models/Role'); 

class RoleController {

  static createRole = async(req, res) => {
    try {
      // console.log('Creating role with data:', req.body);
      const { name, display_name, description, menulist, parent_id } = req.body;

      // Check if role with same name already exists
      const existingRole = await Role.findOne({ name });
      if (existingRole) {
        return res.status(400).json({
          success: false,
          message: 'Role with this name already exists'
        });
      }
      
      // if (parent_id) {
      //   await Role.validateParentChild(null, parent_id);
      // }
      // console.log('Parent ID:', parent_id);return
      const role = new Role({
        name,
        display_name,
        description,
        menulist,
        parent_id: parent_id || null
      });

      const savedRole = await role.save();
      
      // Populate parent information in response
      await savedRole.populate('parent', 'name display_name');
      
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
      const { page = 1, limit = 10, search, parent_id, level, hierarchy = false } = req.query;
      const skip = (page - 1) * limit;

      let query = {};
      
      // Search functionality
      if (search) {
        query = {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { display_name: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          ]
        };
      }

      // Filter by parent_id
      if (parent_id !== undefined) {
        query.parent_id = parent_id === 'null' || parent_id === '' ? null : parent_id;
      }

      // Filter by level
      if (level !== undefined) {
        query.level = parseInt(level);
      }

      // If hierarchy is requested, return tree structure
      if (hierarchy === 'true') {
        const hierarchyTree = await Role.getHierarchyTree();
        return res.status(200).json({
          success: true,
          data: hierarchyTree,
          message: 'Role hierarchy retrieved successfully'
        });
      }

      const roles = await Role.find(query)
        .populate('parent', 'name display_name')
        .sort({ level: 1, name: 1 })
        .skip(skip)
        .limit(parseInt(limit));

      const total = await Role.countDocuments(query);

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
      const { include_children = false, include_ancestors = false } = req.query;
      
      const role = await Role.findById(id)
        .populate('parent', 'name display_name level');
      
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      let responseData = role.toObject();

      // Include children if requested
      if (include_children === 'true') {
        responseData.children = await role.getChildren();
      }

      // Include ancestors if requested
      if (include_ancestors === 'true') {
        responseData.ancestors = await role.getAncestors();
      }

      res.status(200).json({
        success: true,
        data: responseData
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
      const { name, display_name, description, menulist, parent_id } = req.body;

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

      // Validate parent-child relationship if parent_id is being changed
      if (parent_id !== undefined && parent_id !== role.parent_id?.toString()) {
        await Role.validateParentChild(id, parent_id);
      }

      const updatedRole = await Role.findByIdAndUpdate(
        id,
        {
          name,
          display_name,
          description,
          menulist,
          parent_id: parent_id === '' ? null : parent_id
        },
        { new: true, runValidators: true }
      ).populate('parent', 'name display_name');

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
      const { force = false } = req.query;

      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Check if role has children
      const children = await role.getChildren();
      if (children.length > 0 && force !== 'true') {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete role with child roles. Use force=true to delete all descendants or reassign children first.',
          children_count: children.length
        });
      }

      // If force delete, remove all descendants
      if (force === 'true') {
        const descendants = await role.getDescendants();
        const descendantIds = descendants.map(d => d._id);
        await Role.deleteMany({ _id: { $in: descendantIds } });
      }

      await Role.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: force === 'true' 
          ? `Role and ${children.length} descendants deleted successfully`
          : 'Role deleted successfully'
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
      const { ids, force = false } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Please provide an array of role IDs'
        });
      }

      let deletedCount = 0;

      for (const id of ids) {
        const role = await Role.findById(id);
        if (role) {
          const children = await role.getChildren();
          
          if (children.length > 0 && !force) {
            continue; // Skip roles with children if not force delete
          }

          if (force) {
            const descendants = await role.getDescendants();
            const descendantIds = descendants.map(d => d._id);
            await Role.deleteMany({ _id: { $in: descendantIds } });
            deletedCount += descendants.length;
          }

          await Role.findByIdAndDelete(id);
          deletedCount++;
        }
      }

      res.status(200).json({
        success: true,
        message: `${deletedCount} roles deleted successfully`,
        deleted_count: deletedCount
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
      })
      .populate('parent', 'name display_name')
      .sort({ level: 1, name: 1 });

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

  // New methods for parent-child relationship management

  static getRoleHierarchy = async(req, res) => {
    try {
      const { root_id = null } = req.query;
      
      const hierarchy = await Role.getHierarchyTree(root_id);
      
      res.status(200).json({
        success: true,
        data: hierarchy,
        message: 'Role hierarchy retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role hierarchy',
        error: error.message
      });
    }
  }

  static getRoleChildren = async(req, res) => {
    try {
      const { id } = req.params;
      
      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      const children = await role.getChildren();
      
      res.status(200).json({
        success: true,
        data: children,
        count: children.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role children',
        error: error.message
      });
    }
  }

  static getRoleAncestors = async(req, res) => {
    try {
      const { id } = req.params;
      
      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      const ancestors = await role.getAncestors();
      
      res.status(200).json({
        success: true,
        data: ancestors,
        count: ancestors.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role ancestors',
        error: error.message
      });
    }
  }

  static getRoleDescendants = async(req, res) => {
    try {
      const { id } = req.params;
      
      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      const descendants = await role.getDescendants();
      
      res.status(200).json({
        success: true,
        data: descendants,
        count: descendants.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role descendants',
        error: error.message
      });
    }
  }

  static moveRole = async(req, res) => {
    try {
      const { id } = req.params;
      const { new_parent_id } = req.body;
      
      const role = await Role.findById(id);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Validate the new parent-child relationship
      await Role.validateParentChild(id, new_parent_id);

      // Update the role with new parent
      const updatedRole = await Role.findByIdAndUpdate(
        id,
        { parent_id: new_parent_id || null },
        { new: true, runValidators: true }
      ).populate('parent', 'name display_name');

      res.status(200).json({
        success: true,
        message: 'Role moved successfully',
        data: updatedRole
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error moving role',
        error: error.message
      });
    }
  }

  static getRolesByLevel = async(req, res) => {
    try {
      const { level } = req.params;
      
      const roles = await Role.find({ level: parseInt(level) })
        .populate('parent', 'name display_name')
        .sort({ name: 1 });
      
      res.status(200).json({
        success: true,
        data: roles,
        count: roles.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching roles by level',
        error: error.message
      });
    }
  }
}

module.exports = RoleController;