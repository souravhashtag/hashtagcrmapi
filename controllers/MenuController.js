const Menu = require('../models/Menu');
class MenuController {
    static create = async (req, res) => {
        try {
            const { name, slug,icon,status } = req.body;
            const menu = new Menu({ name, slug,icon,status, createdBy: req.user.id });
            await menu.save();
            res.status(200).json({status:200, message: 'Success',menu });
        } catch (err) {
            res.status(500).json({status:500, message: 'Something went wrong',error: err.message });
        }
    };
    static list = async (req,res) => {
        try {
            const menus = await Menu.find().sort({ createdAt: -1 });
            res.status(200).json(menus);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }     
    }
    static getMenuById = async (req,res) => {
        try {
            const { id } = req.params;
            const menus = await Menu.findOne({_id:id});
           if (!menus) {
                return res.status(404).json({ message: 'Menu not found' });
            }
            return res.status(200).json(menus);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }     
    }
    static update = async (req, res) => {
        try {
            const { id } = req.params;
            const { name, slug, icon, status } = req.body;

            const updatedMenu = await Menu.findByIdAndUpdate(
            id,
            {
                name,
                slug,
                icon,
                status,
                updatedBy: req.user.id,
                updatedAt: Date.now(),
            },
            { new: true } 
            );

            if (!updatedMenu) {
            return res.status(404).json({ status: 404, message: 'Menu not found' });
            }

            return res.status(200).json({ status: 200, message: 'Menu updated successfully', menu: updatedMenu });
        } catch (err) {
            return res.status(500).json({ status: 500, message: 'Something went wrong', error: err.message });
        }
    };
    static delete = async (req,res) => {
        try {
            const { id } = req.params;
            const menus = await Menu.findOneAndDelete({_id:id});
           if (!menus) {
                return res.status(404).json({ message: 'Menu not found' });
            }
            return res.status(200).json({ status: 200, message: 'Menu Deleted successfully' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }     
    }
}

module.exports = MenuController;

