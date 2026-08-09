global.crypto = require('crypto'); // Forces crypto globally so the MongoDB driver can find it
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); 
const User = require('./models/User'); 

const app = express();
app.use(cors());
app.use(express.json()); 

app.use(express.static('public')); 

// ==========================================
// DATABASE CONNECTION
// ==========================================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ SUCCESS: Connected to MongoDB!'))
    .catch((error) => console.error('❌ FAILED:', error));

// ==========================================
// 1. SIMPLIFIED USER DATA SYNC (No Login/OTP)
// ==========================================
app.post('/api/user', async (req, res) => {
    try {
        const { name, age, sex, email } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required." });

        let user = await User.findOne({ email });
        if (user) {
            user.name = name || user.name;
            user.age = age || user.age;
            user.sex = sex || user.sex;
        } else {
            user = new User({ name, age, sex, email, meals: [], calorieGoal: 2500 });
        }
        await user.save();
        res.status(200).json({ message: "User synced successfully!", user });
    } catch (error) { 
        res.status(500).json({ error: "Failed to sync user." }); 
    }
});

// ==========================================
// 2. SETTINGS & PROFILE
// ==========================================
app.put('/api/goal', async (req, res) => {
    try {
        const { email, calorieGoal } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required." });
        await User.findOneAndUpdate({ email }, { calorieGoal });
        res.status(200).json({ message: "Goal updated successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to update goal." }); }
});

app.get('/api/profile', async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: "Email is required." });
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found." });
        res.status(200).json({ name: user.name, age: user.age, sex: user.sex, calorieGoal: user.calorieGoal || 2500 });
    } catch (error) { res.status(500).json({ error: "Failed to fetch profile." }); }
});

app.put('/api/profile', async (req, res) => {
    try {
        const { email, name, age, sex } = req.body;
        if (!email) return res.status(400).json({ error: "Email is required." });
        await User.findOneAndUpdate({ email }, { name, age, sex });
        res.status(200).json({ message: "Profile updated successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to update profile." }); }
});

// ==========================================
// 3. MEAL TRACKING
// ==========================================
app.post('/api/meals', async (req, res) => {
    try {
        const { email, mealData } = req.body; 
        if (!email) return res.status(400).json({ error: "Email is required." });
        const user = await User.findOneAndUpdate({ email }, { $push: { meals: mealData } }, { new: true, upsert: true });
        const addedMeal = user.meals[user.meals.length - 1]; 
        res.status(200).json({ message: "Success!", meal: addedMeal });
    } catch (error) { res.status(500).json({ error: "Failed to save meal." }); }
});

app.get('/api/meals', async (req, res) => {
    try {
        const { email, date } = req.query; 
        if (!email) return res.status(400).json({ error: "Email is required." });
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
        if (!email) return res.status(400).json({ error: "Email is required." });
        await User.findOneAndUpdate({ email }, { $pull: { meals: { _id: mealId } } });
        res.status(200).json({ message: "Deleted successfully!" });
    } catch (error) { res.status(500).json({ error: "Failed to delete meal." }); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
