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
        submenu: { type: Array }
      },
    ],
    default: []
  },
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    default: null
  },
  level: {
    type: Number,
    default: 0,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Level must be an integer'
    }
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

// Indexes for better performance
roleSchema.index({ parent_id: 1 });
roleSchema.index({ path: 1 });
roleSchema.index({ level: 1 });

// Virtuals for relationships
roleSchema.virtual('children', {
  ref: 'Role',
  localField: '_id',
  foreignField: 'parent_id'
});

roleSchema.virtual('parent', {
  ref: 'Role',
  localField: 'parent_id',
  foreignField: '_id',
  justOne: true
});

roleSchema.set('toJSON', { virtuals: true });
roleSchema.set('toObject', { virtuals: true });

// Pre-save middleware for level and path calculation
roleSchema.pre('save', async function(next) {
  try {
    console.log(`Pre-save hook triggered for role: ${this.name}, isNew: ${this.isNew}, parent_id modified: ${this.isModified('parent_id')}`);
    
    if (this.isNew || this.isModified('parent_id')) {
      const originalLevel = this.get('level') || 0;
      const originalPath = this.get('path') || '';

      // Calculate level and path
      if (this.parent_id) {
        const parent = await this.constructor.findById(this.parent_id).select('level path');
        if (!parent) {
          throw new Error(`Parent role not found: ${this.parent_id}`);
        }
        this.level = parent.level + 1;
        this.path = parent.path ? `${parent.path}/${parent._id}` : `/${parent._id}`;
        console.log(`Set level: ${this.level}, path: ${this.path} for role: ${this.name}`);
      } else {
        this.level = 0;
        this.path = '';
        console.log(`Set root level: ${this.level}, path: ${this.path} for role: ${this.name}`);
      }

      // Validate level
      if (this.level < 0 || !Number.isInteger(this.level)) {
        throw new Error(`Invalid level calculated: ${this.level}`);
      }

      // Update descendants if parent_id changed
      if (!this.isNew && this.isModified('parent_id')) {
        console.log(`Updating descendants for role: ${this.name}`);
        const descendants = await this.constructor.find({
          path: new RegExp(`^${originalPath}/${this._id}`)
        });

        for (const descendant of descendants) {
          const levelDiff = this.level - originalLevel;
          const newPath = descendant.path.replace(
            new RegExp(`^${originalPath}/${this._id}`),
            `${this.path}/${this._id}`
          );

          await this.constructor.updateOne(
            { _id: descendant._id },
            {
              $set: {
                level: descendant.level + levelDiff,
                path: newPath
              }
            }
          );
          console.log(`Updated descendant ${descendant.name}: level=${descendant.level + levelDiff}, path=${newPath}`);
        }
      }
    }
    next();
  } catch (error) {
    console.error(`Error in pre-save hook for role ${this.name}:`, error);
    next(error);
  }
});

// Pre-update middleware for updateOne/updateMany
// roleSchema.pre(['updateOne', 'findOneAndUpdate'], async function(next) {
//   //console.log('*** ENTERED PRE-UPDATE HOOK ***');
//   try {
//     const update = this.getUpdate();
    

//     // Check if parent_id is being updated
//     let newParentId = null;
//     if (update.$set && 'parent_id' in update.$set) {
//       newParentId = update.$set.parent_id;
//       //console.log(`Detected parent_id in $set: ${newParentId}`);
//     } else if (update.parent_id !== undefined) {
//       newParentId = update.parent_id;
//     } else {
//       //console.log('No parent_id update detected in query');
//     }

//     if (newParentId !== null || update.$set?.parent_id === null) {
//       //console.log('Processing parent_id update for role');
//       const doc = await this.model.findOne(this.getQuery()).select('level path _id name');
//       if (!doc) {
//         //console.log('Role not found for update');
//         throw new Error(`Role not found for query: ${JSON.stringify(this.getQuery())}`);
//       }

//       //console.log(`Updating role ${doc.name} (${doc._id}), current level: ${doc.level}, current path: ${doc.path}, new parent_id: ${newParentId}`);

//       // Validate parent-child relationship
//       if (newParentId) {
//         //console.log(`Validating parent-child relationship for child ${doc._id} and parent ${newParentId}`);
//         await this.model.validateParentChild(doc._id, newParentId);
//       }

//       // Calculate new level and path
//       let newLevel = 0;
//       let newPath = '';
//       if (newParentId) {
//         const parent = await this.model.findById(newParentId).select('level path');
//         if (!parent) {
//           //console.log(`Parent role not found: ${newParentId}`);
//           throw new Error(`Parent role not found: ${newParentId}`);
//         }
//         newLevel = parent.level + 1;
//         newPath = parent.path ? `${parent.path}/${parent._id}` : `/${parent._id}`;
//         //console.log(`Calculated new level: ${newLevel}, new path: ${newPath}`);
//       } else {
//         //console.log('Setting role as root (no parent)');
//         newLevel = 0;
//         newPath = '';
//       }

//       // Merge with existing $set or create new one
//       const updateFields = { ...update.$set, level: newLevel, path: newPath };
//       //console.log(`Setting update with level: ${newLevel}, path: ${newPath} for role ${doc.name} (${doc._id})`);
//       this.setUpdate({ $set: updateFields });

//       // Update descendants
//       //console.log(`Checking for descendants of role ${doc.name} (${doc._id})`);
//       const descendants = await this.model.find({
//         path: new RegExp(`^${doc.path}/${doc._id}`)
//       });

//       if (descendants.length > 0) {
//         console.log(`Found ${descendants.length} descendants to update`);
//         for (const descendant of descendants) {
//           const levelDiff = newLevel - doc.level;
//           const newDescendantPath = descendant.path.replace(
//             new RegExp(`^${doc.path}/${doc._id}`),
//             `${newPath}/${doc._id}`
//           );

//           await this.model.updateOne(
//             { _id: descendant._id },
//             {
//               $set: {
//                 level: descendant.level + levelDiff,
//                 path: newDescendantPath
//               }
//             }
//           );
//           //console.log(`Updated descendant ${descendant.name}: level=${descendant.level + levelDiff}, path=${newDescendantPath}`);
//         }
//       } else {
//         // console.log('No descendants found to update');
//       }
//     } else {
//       // console.log('No parent_id update detected, skipping level recalculation');
//     }
//     // console.log('*** EXITING PRE-UPDATE HOOK ***');
//     next();
//   } catch (error) {
//     console.error('Error in pre-update hook:', error);
//     next(error);
//   }
// });

// Helper method to manually recalculate level and path
roleSchema.statics.recalculateLevelAndPath = async function(roleId) {
  try {
    console.log(`*** ENTERED RECALCULATE LEVEL AND PATH FOR ROLE ${roleId} ***`);
    const role = await this.findById(roleId).select('parent_id level path name');
    if (!role) {
      console.log(`Role not found: ${roleId}`);
      throw new Error(`Role not found: ${roleId}`);
    }

    console.log(`Processing role ${role.name} (${roleId}), current level: ${role.level}, current path: ${role.path}`);

    const originalLevel = role.level;
    const originalPath = role.path;

    if (role.parent_id) {
      const parent = await this.findById(role.parent_id).select('level path');
      if (!parent) {
        console.log(`Parent role not found: ${role.parent_id}`);
        throw new Error(`Parent role not found: ${role.parent_id}`);
      }
      role.level = parent.level + 1;
      role.path = parent.path ? `${parent.path}/${parent._id}` : `/${parent._id}`;
      console.log(`Calculated new level: ${role.level}, new path: ${role.path}`);
    } else {
      role.level = 0;
      role.path = '';
      console.log('Set as root role: level=0, path=""');
    }

    // Validate level
    if (role.level < 0 || !Number.isInteger(role.level)) {
      console.log(`Invalid level calculated: ${role.level}`);
      throw new Error(`Invalid level calculated: ${role.level}`);
    }

    // Save the role
    await role.save();
    console.log(`Saved role ${role.name} (${roleId}): level=${role.level}, path=${role.path}`);

    // Update descendants
    console.log(`Checking for descendants of role ${role.name} (${roleId})`);
    const descendants = await this.find({
      path: new RegExp(`^${originalPath}/${roleId}`)
    });

    if (descendants.length > 0) {
      console.log(`Found ${descendants.length} descendants to update`);
      for (const descendant of descendants) {
        const levelDiff = role.level - originalLevel;
        const newPath = descendant.path.replace(
          new RegExp(`^${originalPath}/${roleId}`),
          `${role.path}/${roleId}`
        );

        await this.updateOne(
          { _id: descendant._id },
          {
            $set: {
              level: descendant.level + levelDiff,
              path: newPath
            }
          }
        );
        console.log(`Updated descendant ${descendant.name}: level=${descendant.level + levelDiff}, path=${newPath}`);
      }
    } else {
      console.log('No descendants found to update');
    }

    console.log(`*** COMPLETED RECALCULATE LEVEL AND PATH FOR ROLE ${roleId} ***`);
    return role;
  } catch (error) {
    console.error(`Error recalculating level for role ${roleId}:`, error);
    throw error;
  }
};

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
    parent_id: this._id,
    is_active: true
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
  try {
    const roles = await this.find({ 
      parent_id: parentId,
      is_active: true 
    })
    .populate('parent', 'name display_name level')
    .sort({ name: 1 })
    .lean();
    
    for (let role of roles) {
      const children = await this.getHierarchyTree(role._id);
      role.children = children;
      role.hasChildren = children.length > 0;
      role.childrenCount = children.length;
      role.totalDescendants = children.reduce((total, child) => 
        total + (child.totalDescendants || 0) + 1, 0);
    }
    
    return roles;
  } catch (error) {
    console.error('Error building hierarchy tree:', error);
    throw error;
  }
};

// Static method to validate parent-child relationship
roleSchema.statics.validateParentChild = async function(childId, parentId) {
  if (!parentId) return true;
  
  const child = await this.findById(childId);
  const parent = await this.findById(parentId);
  
  if (!parent) {
    console.log(`Parent role validation failed: Parent ${parentId} not found`);
    throw new Error(`Parent role not found: ${parentId}`);
  }
  
  if (childId && childId.toString() === parentId.toString()) {
    console.log('Parent role validation failed: Role cannot be its own parent');
    throw new Error('Role cannot be its own parent');
  }
  
  if (child && parent.path.includes(`/${childId}`)) {
    console.log('Parent role validation failed: Cannot set descendant as parent');
    throw new Error('Cannot set descendant as parent (would create circular reference)');
  }
  
  console.log(`Parent-child validation passed for child ${childId} and parent ${parentId}`);
  return true;
};

// Enhanced method to get role with full context
roleSchema.statics.getRoleWithContext = async function(roleId) {
  try {
    const role = await this.findById(roleId)
      .populate('parent', 'name display_name level')
      .lean();
    
    if (!role) {
      console.log(`Role not found in getRoleWithContext: ${roleId}`);
      throw new Error(`Role not found: ${roleId}`);
    }
    
    const ancestors = role.path ? 
      await this.find({
        _id: { $in: role.path.split('/').filter(id => id) }
      })
      .select('name display_name level')
      .sort({ level: 1 })
      .lean() : [];
    
    const children = await this.find({ parent_id: role._id, is_active: true })
      .select('name display_name level')
      .sort({ name: 1 })
      .lean();
    
    const descendantsCount = await this.countDocuments({
      path: new RegExp(`/${role._id}(/|$)`),
      is_active: true
    });
    
    console.log(`Fetched role ${role.name} (${roleId}) with context: ${descendantsCount} descendants`);
    return {
      ...role,
      ancestors,
      children,
      descendantsCount,
      breadcrumb: ancestors.map(a => a.display_name || a.name).join(' > ')
    };
  } catch (error) {
    console.error('Error getting role with context:', error);
    throw error;
  }
};

module.exports = mongoose.model('Role', roleSchema);