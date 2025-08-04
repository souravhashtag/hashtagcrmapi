const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true, 
    trim: true
  },
  display_name: {
    type: String,
    default: null,
    trim: true
  },
  description: {
    type: String,
    default: null,
    trim: true
  },
  menulist: {
    type: [
        {
          name: { type: String },
          slug: { type: String },
          icon: { type: String },
          submenu:{ type: Array }
        },
    ],
    default: []
  },
  // Parent-Child Relationship Fields
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null
  },
  level: {
    type: Number,
    default: 0
  },
  path: {
    type: String,
    default: ''
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true 
});

// Index for better performance on hierarchy queries
roleSchema.index({ parent_id: 1 });
roleSchema.index({ path: 1 });
roleSchema.index({ level: 1 });

// Virtual for children
roleSchema.virtual('children', {
  ref: 'Role',
  localField: '_id',
  foreignField: 'parent_id'
});

// Virtual for parent
roleSchema.virtual('parent', {
  ref: 'Role',
  localField: 'parent_id',
  foreignField: '_id',
  justOne: true
});

// Ensure virtuals are included when converting to JSON
roleSchema.set('toJSON', { virtuals: true });
roleSchema.set('toObject', { virtuals: true });

// Pre-save middleware to calculate level and path
roleSchema.pre('save', async function(next) {
  if (this.isModified('parent_id') || this.isNew) {
    if (this.parent_id) {
      const parent = await this.constructor.findById(this.parent_id);
      if (parent) {
        this.level = parent.level + 1;
        this.path = parent.path ? `${parent.path}/${parent._id}` : `/${parent._id}`;
      }
    } else {
      this.level = 0;
      this.path = '';
    }
  }
  next();
});

// Method to get all descendants
roleSchema.methods.getDescendants = async function() {
  const pathRegex = new RegExp(`^${this.path}/${this._id}`);
  return await this.constructor.find({
    path: pathRegex,
    _id: { $ne: this._id }
  }).sort({ level: 1, name: 1 });
};

// Method to get all ancestors
roleSchema.methods.getAncestors = async function() {
  if (!this.path) return [];
  
  const ancestorIds = this.path.split('/').filter(id => id);
  return await this.constructor.find({
    _id: { $in: ancestorIds }
  }).sort({ level: 1 });
};

// Method to get immediate children
roleSchema.methods.getChildren = async function() {
  return await this.constructor.find({
    parent_id: this._id
  }).sort({ name: 1 });
};

// Method to check if role is ancestor of another role
roleSchema.methods.isAncestorOf = function(otherRole) {
  return otherRole.path.includes(`/${this._id}`);
};

// Method to check if role is descendant of another role
roleSchema.methods.isDescendantOf = function(otherRole) {
  return this.path.includes(`/${otherRole._id}`);
};

// Static method to get role hierarchy tree
roleSchema.statics.getHierarchyTree = async function(parentId = null) {
  const roles = await this.find({ parent_id: parentId }).sort({ name: 1 });
  
  for (let role of roles) {
    role.children = await this.getHierarchyTree(role._id);
  }
  
  return roles;
};

// Static method to validate parent-child relationship
roleSchema.statics.validateParentChild = async function(childId, parentId) {
  if (!parentId) return true; // Root level is always valid
  
  const child = await this.findById(childId);
  const parent = await this.findById(parentId);
  
  if (!parent) {
    throw new Error('Parent role not found');
  }
  
  // Check if trying to set child as its own parent
  if (childId.toString() === parentId.toString()) {
    throw new Error('Role cannot be its own parent');
  }
  
  // Check if parent is a descendant of child (would create circular reference)
  if (child && parent.path.includes(`/${childId}`)) {
    throw new Error('Cannot set descendant as parent (would create circular reference)');
  }
  
  return true;
};

module.exports = mongoose.model('Role', roleSchema);