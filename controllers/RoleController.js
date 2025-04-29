const Role = require("../models/Role");

// Create a new role
exports.createRole = async (req, res) => {
  try {
    const { name, display_name, description } = req.body;

    const existingRole = await Role.findOne({ name });
    if (existingRole) {
      return res.status(400).json({ message: 'Role with this name already exists.' });
    }

    const role = new Role({ name, display_name, description });
    await role.save();

    res.status(201).json({ message: 'Role created successfully.', role });
  } catch (error) {
    res.status(500).json({ message: 'Error creating role', error });
  }
};

// Get all roles
exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ createdAt: -1 });
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching roles', error });
  }
};

// Get a single role by ID
exports.getRoleById = async (req, res) => {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    res.status(200).json(role);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching role', error });
  }
};

// Update a role
exports.updateRole = async (req, res) => {
  try {
    const { name, display_name, description } = req.body;

    const role = await Role.findByIdAndUpdate(
      req.params.id,
      { name, display_name, description },
      { new: true, runValidators: true }
    );

    if (!role) return res.status(404).json({ message: 'Role not found' });

    res.status(200).json({ message: 'Role updated successfully', role });
  } catch (error) {
    res.status(500).json({ message: 'Error updating role', error });
  }
};

// Delete a role
exports.deleteRole = async (req, res) => {
  try {
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) return res.status(404).json({ message: 'Role not found' });

    res.status(200).json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting role', error });
  }
};
