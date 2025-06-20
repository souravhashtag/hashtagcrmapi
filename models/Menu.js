const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  icon: {
    type: String,
    trim: true,
    default: 'Folder'
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  parentIds: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: 'Menu',
    default: [],
    validate: {
      validator: function(arr) {
        return arr.length <= 10;
      },
      message: 'Cannot have more than 10 parent menus'
    }
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    max: 4
  },
  order: {
    type: Number,
    enum: [0, 1],
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
menuSchema.index({ parentIds: 1, order: 1 });
menuSchema.index({ level: 1, order: 1 });
menuSchema.index({ slug: 1 });
menuSchema.index({ status: 1 });

// Virtual to get children
menuSchema.virtual('children', {
  ref: 'Menu',
  localField: '_id',
  foreignField: 'parentIds'
});

// Method to get all possible full paths (since menu can have multiple parents)
menuSchema.methods.getFullPaths = async function() {
  const paths = [];
  
  if (this.parentIds.length === 0) {
    return [this.name]; // Root level menu
  }
  
  // Get all parent paths
  for (const parentId of this.parentIds) {
    const parent = await this.constructor.findById(parentId);
    if (parent) {
      const parentPaths = await parent.getFullPaths();
      parentPaths.forEach(parentPath => {
        paths.push(`${parentPath} > ${this.name}`);
      });
    }
  }
  
  return paths.length > 0 ? paths : [this.name];
};

// Static method to get menu tree
menuSchema.statics.getMenuTree = async function(parentId = null, level = 0) {
  let query;
  
  if (parentId === null) {
    // Root level menus (no parents)
    query = { 
      $or: [
        { parentIds: { $size: 0 } },
        { parentIds: { $exists: false } }
      ],
      status: 'active'
    };
  } else {
    // Menus that have this parentId in their parentIds array
    query = { 
      parentIds: parentId,
      status: 'active'
    };
  }
  
  const menus = await this.find(query).sort({ order: 1, name: 1 });
  const menuTree = [];
  
  for (const menu of menus) {
    const menuObj = menu.toObject();
    menuObj.children = await this.getMenuTree(menu._id, level + 1);
    menuTree.push(menuObj);
  }
  
  return menuTree;
};

// Pre-save middleware to set level based on parents
menuSchema.pre('save', async function(next) {
  try {
    if (this.parentIds && this.parentIds.length > 0) {
      // Check for circular references
      if (this._id && this.parentIds.some(parentId => this._id.equals(parentId))) {
        return next(new Error('A menu cannot be its own parent'));
      }
      
      // Get all parents and find the maximum level
      const parents = await this.constructor.find({ 
        _id: { $in: this.parentIds } 
      });
      
      if (parents.length !== this.parentIds.length) {
        return next(new Error('One or more parent menus not found'));
      }
      
      // Set level to maximum parent level + 1
      const maxParentLevel = Math.max(...parents.map(p => p.level));
      this.level = maxParentLevel + 1;
      
      // Check maximum depth
      if (this.level > 4) {
        return next(new Error('Maximum menu depth (5 levels) exceeded'));
      }
      
      // Additional circular reference check (recursive)
      for (const parent of parents) {
        if (await this.constructor.hasCircularReference(this._id, parent._id)) {
          return next(new Error('Circular reference detected in menu hierarchy'));
        }
      }
    } else {
      this.level = 0;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Helper method to check circular references
menuSchema.statics.hasCircularReference = async function(menuId, ancestorId, visited = new Set()) {
  if (visited.has(ancestorId.toString())) {
    return true; // Circular reference found
  }
  
  if (menuId.equals(ancestorId)) {
    return true; // Direct circular reference
  }
  
  visited.add(ancestorId.toString());
  
  const ancestor = await this.findById(ancestorId);
  if (!ancestor || !ancestor.parentIds || ancestor.parentIds.length === 0) {
    return false;
  }
  
  // Check all parents recursively
  for (const parentId of ancestor.parentIds) {
    if (await this.hasCircularReference(menuId, parentId, new Set(visited))) {
      return true;
    }
  }
  
  return false;
};

menuSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const children = await this.constructor.find({ 
      parentIds: this._id 
    });
    
    for (const child of children) {
      if (child.parentIds.length === 1) {
        await child.deleteOne();
      } else {
        child.parentIds = child.parentIds.filter(id => !id.equals(this._id));
        await child.save();
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Menu', menuSchema);