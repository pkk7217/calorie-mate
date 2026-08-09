global.crypto = require('crypto'); // Forces crypto globally so the MongoDB driver can find it
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const bcrypt = require('bcryptjs'); 
const jwt = require('jsonwebtoken'); 
const nodemailer = require('nodemailer'); 
const User = require('./models/User'); 

const app = express();
app.use(cors());
app.use(express.json()); 

app.use(express.static('public')); 

const JWT_SECRET = process.env.JWT_SECRET;

// ==========================================
// EMAIL SERVER SETUP (Configured for Brevo SMTP)
// ==========================================
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // Brevo uses TLS on port 587
    auth: {
        user: process.env.GMAIL_USER, // Your Brevo SMTP login email
        pass: process.env.GMAIL_PASS  // Your Brevo SMTP master key
    }
});

// ==========================================
// DATABASE CONNECTION
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ SUCCESS: Connected to MongoDB!'))
    .catch((error) => console.error('❌ FAILED:', error));

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// ==========================================
// 1. REGISTER & VERIFY
// ==========================================
app.post('/api/register', async (req, res) => {
    try {
        const { name, age, sex, email, password } = req.body;
        let user = await User.findOne({ email });
        if (user && user.isVerified) return res.status(400).json({ error: "Account exists." });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const otpExpires = Date.now() + 10 * 60 * 1000;

        if (user) {
            user.name = name; user.age = age; user.sex = sex;
            user.password = hashedPassword; user.otp = otp; user.otpExpires = otpExpires;
        } else {
            user = new User({ name, age, sex, email, password: hashedPassword, otp, otpExpires });
        }
        await user.save();
        
        const mailOptions = {
            from: `Calorie Mate <${process.env.GMAIL_USER}>`,
            to: email, 
            subject: 'Your Calorie Mate Verification Code',
            text: `Hello ${name}!\n\nYour 6-digit verification code is: ${otp}`
        };
        
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "OTP sent!", requireOTP: true });
    } catch (error) { 
        console.error("BREVO ERROR DETAIL:", error); 
        res.status(500).json({ error: error.message || "Registration failed." }); 
    }
});

app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        if (!user || user.otp !== otp || user.otpExpires < Date.now()) return res.status(400).json({ error: "Invalid or expired OTP." });
        user.isVerified = true; user.otp = undefined; user.otpExpires = undefined;
        await user.save();
        const token = jwt.sign({ email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: "Verification successful!", token });
    } catch (error) { res.status(500).json({ error: "Verification failed." }); }
});

// ==========================================
// 2. LOGIN
// ==========================================
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(400).json({ error: "Incorrect email or password." });
        if (!user.isVerified) return res.status(400).json({ error: "Account not verified." });
        const token = jwt.sign({ email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
        res.status(200).json({ message: "Login successful!", token });
    } catch (error) { res.status(500).json({ error: "Failed to log in." }); }
});

// ==========================================
// 3. PASSWORD RESET
// ==========================================
app.post('/api/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "No account found." });
        const otp = generateOTP();
        user.otp = otp; user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        const mailOptions = { from: `Calorie Mate <${process.env.GMAIL_USER}>`, to: email, subject: 'Password Reset', text: `Your code: ${otp}` };
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: "Reset OTP sent!" });
    } catch (error) { res.status(500).json({ error: "Failed to send reset email." }); }
});

app.post('/api/reset-password', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        const user = await User.findOne({ email });
        if (!user || user.otp !== otp || user.otpExpires < Date.now()) return res.status(400).json({ error: "Invalid OTP." });
        user.password = await bcrypt.hash(newPassword, 10);
        user.otp = undefined; user.otpExpires = undefined;
        await user.save();
        res.status(200).json({ message: "Password updated successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to reset password." }); }
});

// ==========================================
// 4. SETTINGS & PROFILE
// ==========================================
app.put('/api/goal', async (req, res) => {
    try {
        const { email, calorieGoal } = req.body;
        if (!email) return res.status(401).json({ error: "Unauthorized." });
        await User.findOneAndUpdate({ email }, { calorieGoal });
        res.status(200).json({ message: "Goal updated successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to update goal." }); }
});

app.get('/api/profile', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(401).json({ error: "Unauthorized." });
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found." });
        res.status(200).json({ name: user.name, age: user.age, sex: user.sex });
    } catch (error) { res.status(500).json({ error: "Failed to fetch profile." }); }
});

app.put('/api/profile', async (req, res) => {
    try {
        const { email, name, age, sex } = req.body;
        if (!email) return res.status(401).json({ error: "Unauthorized." });
        await User.findOneAndUpdate({ email }, { name, age, sex });
        res.status(200).json({ message: "Profile updated successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to update profile." }); }
});

// ==========================================
// 5. MEAL TRACKING
// ==========================================
app.post('/api/meals', async (req, res) => {
    try {
        const { email, mealData } = req.body; 
        if (!email) return res.status(401).json({ error: "Unauthorized." });
        const user = await User.findOneAndUpdate({ email }, { $push: { meals: mealData } }, { new: true, upsert: true });
        const addedMeal = user.meals[user.meals.length - 1]; 
        res.status(200).json({ message: "Success!", meal: addedMeal });
    } catch (error) { res.status(500).json({ error: "Failed to save meal." }); }
});

app.get('/api/meals', async (req, res) => {
    try {
        const { email, date } = req.query; 
        if (!email) return res.status(401).json({ error: "Unauthorized." });
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found." });

        let dayMeals = user.meals || [];
        if (date) { dayMeals = dayMeals.filter(meal => meal.date === date); }
        res.status(200).json({ meals: dayMeals, calorieGoal: user.calorieGoal || 2500 });
    } catch (error) { res.status(500).json({ error: "Failed to fetch meals." }); }
});

app.delete('/api/meals/:mealId', async (req, res) => {
    try {
        const { email } = req.body;
        const { mealId } = req.params;
        if (!email) return res.status(401).json({ error: "Unauthorized." });
        await User.findOneAndUpdate({ email }, { $pull: { meals: { _id: mealId } } });
        res.status(200).json({ message: "Deleted successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to delete meal." }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
