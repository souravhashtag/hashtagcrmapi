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
      // console.log('Updating role with ID:', id, 'Data:', req.body);return
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
      // console.log('Parent ID:', parent_id);return
      // console.log('Updating role with parent ID:', parentId);return
      const updatedRole = await Role.findByIdAndUpdate(
        id,
        {
          name,
          display_name,
          description,
          menulist,
          parent_id:  parent_id
        },
        { new: true, runValidators: true }
      )
      .populate('parent', 'name display_name');
      // console.log('Updated Role:', updatedRole);return
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
  static assignRoleToUser = async(req, res) => {
    try {
      const { id: roleId } = req.params;
      const { userId } = req.body;

      // Validate role exists
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }    

      res.status(200).json({
        success: true,
        message: 'Role assigned to user successfully',
        data: {
          roleId,
          userId,
          assignedAt: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error assigning role to user',
        error: error.message
      });
    }
  }

  static unassignRoleFromUser = async(req, res) => {
    try {
      const { id: roleId } = req.params;
      const { userId } = req.body;

      // Validate role exists
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }   

      res.status(200).json({
        success: true,
        message: 'Role unassigned from user successfully',
        data: {
          roleId,
          userId,
          unassignedAt: new Date()
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error unassigning role from user',
        error: error.message
      });
    }
  }

  static getRoleUsers = async(req, res) => {
    try {
      const { id: roleId } = req.params;

      // Validate role exists
      const role = await Role.findById(roleId);
      if (!role) {
        return res.status(404).json({
          success: false,
          message: 'Role not found'
        });
      }

      // Option 1: Find users with this role
      // const users = await User.find({ roles: roleId })
      //   .select('name email department position')
      //   .lean();

      // Option 2: Find through UserRole model
      // const userRoles = await UserRole.find({ roleId }).populate('userId');
      // const users = userRoles.map(ur => ur.userId);

      // Mock response for now
      const users = [];

      res.status(200).json({
        success: true,
        data: users,
        count: users.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching role users',
        error: error.message
      });
    }
  }
  static getHierarchyTree = async(req, res) => {
    try {
      const { root_id } = req.query;
      console.log('Fetching hierarchy tree with root_id:', root_id);
      // If root_id is provided, get tree from that root, otherwise get all root roles
      const parentId = root_id || null;
      
      const tree = await Role.getHierarchyTree(parentId);
      
      res.status(200).json({
        success: true,
        data: tree,
        message: 'Role hierarchy tree retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching role hierarchy tree:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching role hierarchy tree',
        error: error.message
      });
    }
  }

  // Validate role hierarchy
  static validateRoleHierarchy = async(req, res) => {
    try {
      const { childId, parentId } = req.query;
      
      const isValid = await Role.validateParentChild(childId, parentId);
      
      res.status(200).json({
        success: true,
        data: { isValid: true },
        message: 'Role hierarchy is valid'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        data: { isValid: false },
        message: error.message,
        error: error.message
      });
    }
  }

  // Get flat hierarchy (for dropdowns, etc.)
  static getFlatHierarchy = async(req, res) => {
    try {
      const roles = await Role.find({ is_active: true })
        .populate('parent', 'name display_name')
        .sort({ level: 1, name: 1 });
      
      // Format for easy display with indentation
      const formattedRoles = roles.map(role => ({
        ...role.toObject(),
        displayName: '  '.repeat(role.level) + (role.display_name || role.name),
        hierarchyPath: role.path ? role.path.split('/').filter(id => id).length : 0
      }));
      
      res.status(200).json({
        success: true,
        data: formattedRoles,
        message: 'Flat role hierarchy retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching flat hierarchy:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching flat hierarchy',
        error: error.message
      });
    }
  }

  // Get role statistics
  static getRoleStats = async(req, res) => {
    try {
      const totalRoles = await Role.countDocuments({ is_active: true });
      const rolesByLevel = await Role.aggregate([
        { $match: { is_active: true } },
        { $group: { _id: '$level', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]);
      
      const maxLevel = await Role.findOne({ is_active: true })
        .sort({ level: -1 })
        .select('level');
      
      const rootRoles = await Role.countDocuments({ 
        parent_id: null, 
        is_active: true 
      });
      
      res.status(200).json({
        success: true,
        data: {
          totalRoles,
          maxLevel: maxLevel?.level || 0,
          rootRoles,
          rolesByLevel: rolesByLevel.map(item => ({
            level: item._id,
            count: item.count
          }))
        },
        message: 'Role statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching role stats:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching role statistics',
        error: error.message
      });
    }
  }
}

module.exports = RoleController;