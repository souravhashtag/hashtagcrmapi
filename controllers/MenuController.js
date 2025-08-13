const Menu = require('../models/Menu');
const Role = require('../models/Role');

class MenuController {
  static async getAllMenus(req, res) {
    try {
      const { page = 1, limit = 10, search, parent } = req.query;
      const skip = (page - 1) * limit;

      let query = {};
      
      if (parent) {
        query.order = parseInt(parent);
      }
      
      if (search) {
        const regex = new RegExp(search, 'i');
        const searchQuery = {
          $or: [
            { name: regex },
            { slug: regex }
          ]
        };
        
        query = { ...query, ...searchQuery };
      }

      const menus = await Menu.find(query)
        .populate('parentIds', 'name slug') 
        .populate('createdBy', 'firstName lastName')
        .sort({ level: 1, order: 1, name: 1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit));

      const total = await Menu.countDocuments(query);

      res.status(200).json({
        success: true,
        data: menus,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(total / limit),
          total_records: total,
          per_page: parseInt(limit)
        }
      });
    } catch (error) {
      console.error('Error fetching menus:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching menus',
        error: error.message
      });
    }
  }

  static async getMenuById(req, res) {
    try {
      const { id } = req.params;
      
      const menu = await Menu.findById(id)
        .populate('parentIds', 'name slug') 
        .populate('createdBy', 'firstName lastName');

      if (!menu) {
        return res.status(404).json({
          success: false,
          message: 'Menu not found'
        });
      }

      // Get all possible full paths (since menu can have multiple parents)
      const fullPaths = await menu.getFullPaths();

      res.status(200).json({
        success: true,
        data: {
          ...menu.toObject(),
          fullPaths // Changed from fullPath to fullPaths (array)
        }
      });
    } catch (error) {
      console.error('Error fetching menu:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching menu',
        error: error.message
      });
    }
  }

  // Create new menu
  static async createMenu(req, res) {
    try {
      const menuData = {
        ...req.body,
        createdBy: req.user?.id || req.body.createdBy
      };

      // Validate parents exist if parentIds is provided
      if (menuData.parentIds && menuData.parentIds.length > 0) {
        const parents = await Menu.find({
          _id: { $in: menuData.parentIds }
        });

        if (parents.length !== menuData.parentIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more parent menus not found'
          });
        }

        // Check if any parent exceeds depth limit
        const maxParentLevel = Math.max(...parents.map(p => p.level));
        if (maxParentLevel >= 4) {
          return res.status(400).json({
            success: false,
            message: 'Maximum menu depth (5 levels) exceeded'
          });
        }
      }

      // Auto-generate slug if not provided
      if (!menuData.slug && menuData.name) {
        menuData.slug = menuData.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
      }

      // Validate order value (0 or 1 only)
      if (menuData.order !== undefined && ![0, 1].includes(menuData.order)) {
        return res.status(400).json({
          success: false,
          message: 'Order must be either 0 or 1'
        });
      }

      // Set default order if not provided
      if (menuData.order === undefined) {
        menuData.order = 0; // Default to higher priority
      }

      const menu = new Menu(menuData);
      const savedMenu = await menu.save();
      
      // Populate the saved menu
      await savedMenu.populate('parentIds', 'name slug');
      await savedMenu.populate('createdBy', 'firstName lastName');

      res.status(201).json({
        success: true,
        data: savedMenu,
        message: 'Menu created successfully'
      });
    } catch (error) {
      console.error('Error creating menu:', error);
      
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Menu slug already exists'
        });
      }
      
      res.status(400).json({
        success: false,
        message: 'Failed to create menu',
        error: error.message
      });
    }
  }

  // Update menu
  static async updateMenu(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Validate parents exist if parentIds is being updated
      if (updateData.parentIds && updateData.parentIds.length > 0) {
        // Check for self-reference
        if (updateData.parentIds.includes(id)) {
          return res.status(400).json({
            success: false,
            message: 'A menu cannot be its own parent'
          });
        }

        const parents = await Menu.find({
          _id: { $in: updateData.parentIds }
        });

        if (parents.length !== updateData.parentIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more parent menus not found'
          });
        }
      }else {
        updateData.parentIds = [];
      }

      // Validate order value if being updated
      if (updateData.order !== undefined && ![0, 1].includes(updateData.order)) {
        return res.status(400).json({
          success: false,
          message: 'Order must be either 0 or 1'
        });
      }
      const getUpdatedMenu = await Menu.findById(id);
      const roles = await Role.find();
      // console.log('getUpdatedMenu', getUpdatedMenu);return

      for (const role of roles) {
        let hasChanges = false;
        
        if (role?.menulist) {
          role.menulist = role.menulist.map((menuItem) => {
            if (menuItem?.slug === getUpdatedMenu?.slug) {
              hasChanges = true;
              return {
                ...menuItem,
                name: updateData.name,
                slug: updateData.slug,
                icon: updateData.icon,
                // menuId: getUpdatedMenu._id 
              };
            }
            
            if (menuItem?.submenu && menuItem.submenu.length > 0) {
              const updatedSubmenu = menuItem.submenu.map((subItem) => {
                if (subItem?.slug === getUpdatedMenu?.slug) {
                  hasChanges = true;
                  // console.log('subItem', subItem);
                  return {
                    ...subItem,
                    name: updateData.name,
                    slug: updateData.slug,
                    icon: updateData.icon
                  };                  
                }
                
                return subItem;
              });
              
              return {
                ...menuItem,
                submenu: updatedSubmenu
              };
            }
            
            return menuItem;
          });
          
          if (hasChanges) {
            await role.save();
            // console.log(`Updated role: ${role.name}`);
          }
        }
      }
      // console.log('Update data:', updateData);return
      const updatedMenu = await Menu.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      )
      // .populate('parentIds', 'name slug')
      // .populate('createdBy', 'firstName lastName');

      if (!updatedMenu) {
        return res.status(404).json({
          success: false,
          message: 'Menu not found'
        });
      }

      res.status(200).json({
        success: true,
        data: updatedMenu,
        message: 'Menu updated successfully'
      });
    } catch (error) {
      console.error('Error updating menu:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to update menu',
        error: error.message
      });
    }
  }

  // Delete menu
  static async deleteMenu(req, res) {
    try {
      const { id } = req.params;

      const menu = await Menu.findById(id);
      if (!menu) {
        return res.status(404).json({
          success: false,
          message: 'Menu not found'
        });
      }

      // Check if menu has children (updated for parentIds)
      const childrenCount = await Menu.countDocuments({ 
        parentIds: id 
      });
      // ==============================================================
      const roles = await Role.find();
      //console.log('roles', roles);

      for (const role of roles) {
        let hasChanges = false;
        
        if (role?.menulist) {
          role.menulist = role.menulist.filter((menuItem) => {
            // Remove main menu item if it matches the deleted menu slug
            if (menuItem?.slug === menu?.slug) {
              hasChanges = true;
              return false; // Remove this main menu item
            }
            
            if (menuItem?.submenu && menuItem.submenu.length > 0) {
              const updatedSubmenu = menuItem.submenu.filter((subItem) => {
                if (subItem?.slug === menu?.slug) {
                  hasChanges = true;
                  // console.log('subItem', subItem);
                  return false; // Remove this submenu item
                }
                
                return true; // Keep this submenu item
              });
              
              // FIXED: Assign the filtered submenu back to menuItem.submenu
              menuItem.submenu = updatedSubmenu;
              return true; // Keep this main menu item
            }
            
            return true; // Keep this main menu item
          });
          
          if (hasChanges) {
            await role.save();
            // console.log(`Updated role: ${role.name}`);
          }
        }
      }
      // ==============================================================
      if (childrenCount > 0) {
        return res.status(400).json({
          success: false,
          message: `Cannot delete menu with ${childrenCount} children. Delete children first.`,
          childrenCount
        });
      }

      // Delete the menu
      await menu.deleteOne();

      res.status(200).json({
        success: true,
        message: 'Menu deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting menu:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete menu',
        error: error.message
      });
    }
  }

  // Get menu tree structure
  static async getMenuTree(req, res) {
    try {
      const menuTree = await Menu.getMenuTree();

      res.status(200).json({
        success: true,
        data: menuTree
      });
    } catch (error) {
      console.error('Error fetching menu tree:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching menu tree',
        error: error.message
      });
    }
  }

  // Get breadcrumbs for a menu (returns all possible paths)
  static async getBreadcrumb(req, res) {
    try {
      const { id } = req.params;
      
      const menu = await Menu.findById(id);
      if (!menu) {
        return res.status(404).json({
          success: false,
          message: 'Menu not found'
        });
      }

      const breadcrumbs = [];
      
      if (menu.parentIds.length === 0) {
        // Root level menu
        breadcrumbs.push([{
          id: menu._id,
          name: menu.name,
          slug: menu.slug,
          level: menu.level
        }]);
      } else {
        // Build breadcrumbs for each parent path
        for (const parentId of menu.parentIds) {
          const breadcrumb = [];
          let current = menu;
          
          // Add current menu
          breadcrumb.unshift({
            id: current._id,
            name: current.name,
            slug: current.slug,
            level: current.level
          });
          
          // Trace back through this parent path
          current = await Menu.findById(parentId);
          while (current) {
            breadcrumb.unshift({
              id: current._id,
              name: current.name,
              slug: current.slug,
              level: current.level
            });
            
            // Move to first parent (simplified - you might want more complex logic)
            if (current.parentIds && current.parentIds.length > 0) {
              current = await Menu.findById(current.parentIds[0]);
            } else {
              break;
            }
          }
          
          breadcrumbs.push(breadcrumb);
        }
      }

      res.status(200).json({
        success: true,
        data: breadcrumbs // Array of breadcrumb paths
      });
    } catch (error) {
      console.error('Error fetching breadcrumb:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching breadcrumb',
        error: error.message
      });
    }
  }

  // Get menu statistics
  static async getMenuStats(req, res) {
    try {
      const totalMenus = await Menu.countDocuments();
      const activeMenus = await Menu.countDocuments({ status: 'active' });
      
      // Root menus (no parents)
      const rootMenus = await Menu.countDocuments({ 
        $or: [
          { parentIds: { $size: 0 } },
          { parentIds: { $exists: false } }
        ]
      });
      
      // Menus with multiple parents
      const menusWithMultipleParents = await Menu.countDocuments({
        $expr: { $gt: [{ $size: "$parentIds" }, 1] }
      });
      
      // Level distribution
      const levelStats = await Menu.aggregate([
        {
          $group: {
            _id: '$level',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ]);

      // Order distribution
      const orderStats = await Menu.aggregate([
        {
          $group: {
            _id: '$order',
            count: { $sum: 1 }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalMenus,
          activeMenus,
          inactiveMenus: totalMenus - activeMenus,
          rootMenus,
          menusWithMultipleParents,
          levelStats,
          orderStats
        }
      });
    } catch (error) {
      console.error('Error fetching menu statistics:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching menu statistics',
        error: error.message
      });
    }
  }

  // New endpoint: Update menu relationships
  static async updateMenuRelationships(req, res) {
    try {
      const { id } = req.params;
      const { parentIds } = req.body;

      const menu = await Menu.findById(id);
      if (!menu) {
        return res.status(404).json({
          success: false,
          message: 'Menu not found'
        });
      }

      // Validate parent IDs
      if (parentIds && parentIds.length > 0) {
        if (parentIds.includes(id)) {
          return res.status(400).json({
            success: false,
            message: 'A menu cannot be its own parent'
          });
        }

        const parents = await Menu.find({
          _id: { $in: parentIds }
        });

        if (parents.length !== parentIds.length) {
          return res.status(400).json({
            success: false,
            message: 'One or more parent menus not found'
          });
        }
      }

      // Update parent relationships
      menu.parentIds = parentIds || [];
      const updatedMenu = await menu.save();

      await updatedMenu.populate('parentIds', 'name slug');

      res.status(200).json({
        success: true,
        data: updatedMenu,
        message: 'Menu relationships updated successfully'
      });
    } catch (error) {
      console.error('Error updating menu relationships:', error);
      res.status(400).json({
        success: false,
        message: 'Failed to update menu relationships',
        error: error.message
      });
    }
  }
}

module.exports = MenuController;