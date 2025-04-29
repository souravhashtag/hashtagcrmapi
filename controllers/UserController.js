const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

let refreshTokens = [];
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'your_access_token_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret';

function generateAccessToken(user) {
  return jwt.sign(user, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
}

function generateRefreshToken(user) {
  const refreshToken = jwt.sign(user, REFRESH_TOKEN_SECRET);
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
}

module.exports = UserController;
