const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String },
    age: { type: Number },
    sex: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    
    // 🟢 NEW: Stores the user's custom daily calorie goal
    calorieGoal: { type: Number, default: 2500 }, 
    
    meals: [{
        date: String, 
        category: String,
        name: String,
        calories: Number,
        protein: Number,
        carbs: Number,
        fats: Number
    }]
});

module.exports = mongoose.model('User', userSchema);
