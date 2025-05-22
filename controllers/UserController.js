const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");
const ScreenShot = require("../models/ScreenShot");
const fs = require('fs').promises;
const os = require('os');
const path = require('path');

let refreshTokens = [];
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'your_access_token_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret';

function generateAccessToken(payload) {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
}

function generateRefreshToken(payload) {
  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET);
  refreshTokens.push(refreshToken); 
  return refreshToken;
}

class UserController {
    static register = async (req, res) => {
        try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "User already exists with this email." });
        }

        const hashedPassword = await bcrypt.hash(password, 10); 
        const user = new User({ username, email, password: hashedPassword });
        await user.save();
        res.status(201).json({ message: "User registered successfully" });
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    };
    static login = async (req, res) => {
      try {
        const { email, password } = req.body;
  
        const user = await User.findOne({ email });
        //res.status(200).json({ user });
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
  
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return res.status(400).json({ error: "Invalid credentials" });
        }
        const role = await Role.findById(user.role);
        const accessToken = generateAccessToken({ menu: role?.menulist,id:user._id });
        const refreshToken = generateRefreshToken({ menu: role?.menulist,id:user._id });
        const tokenFilePath = path.join(os.homedir(), 'electron-user-token.txt');
        fs.writeFileSync(tokenFilePath, accessToken);

        
        res.status(200).json({ accessToken, refreshToken});
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    };
    static  ScreenShotUpload = async (req , res) => {
        try{
            //console.log(req.file)
            if (!req.file) {
                return res.status(400).json({ error: "No file uploaded" });
              }     
              // const token = req.headers["authorization"];
              // const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
              //console.log(req.user.id)
              const image = req.file ? req.file.filename : null;
              const screenshot = new ScreenShot({ userid:req.user.id,image });
              const saveimage = await screenshot.save();
          
              res.status(201).json({ message: "Images uploaded successfully", data: saveimage }); 
        }catch(err){
            console.log(err)
        }
    }
    static  GetScreenShot = async (req , res) => {
        try{                 
              const screenshots = await ScreenShot.find().populate('userid', 'name email');          
              res.status(201).json(screenshots );
        }catch(err){
            console.log(err)
        }
    }
    static  DeleteScreenShot = async (req , res) => {
        try {
          const screenshots = await ScreenShot.find();

          // Use Promise.all to wait for all deletions
          await Promise.all(
            screenshots.map(async (item) => {
              const filePath = path.join(process.cwd(), 'uploads/screenshort', item.image);
              try {
                await fs.unlink(filePath);
              } catch (err) {
                console.error(`Failed to delete: ${filePath}`, err.message);
              }
            })
          );

          // Optional: Also remove entries from MongoDB if needed
          // await ScreenShot.deleteMany();

          return res.status(200).send('All files deleted successfully');
        } catch (err) {
          console.error('Error during file deletion:', err);
          return res.status(500).send('Internal server error');
        }
    }
    static verifyToken = async (req, res, next) => {
      try {
        const token = req.headers["authorization"];
        //console.log(token)
        if (!token) {
          return res.status(403).json({ error: "Access denied, no token provided" });
        }

        const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
        req.user = decoded;
        next();
      } catch (err) {
        res.status(401).json({ error: "Invalid or expired token" });
      }
    };
}

module.exports = UserController;
