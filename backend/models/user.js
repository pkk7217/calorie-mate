const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String },
    age: { type: Number },
    sex: { type: String },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Securely stores hashed password
    
    // User's custom daily calorie goal
    calorieGoal: { type: Number, default: 2500 }, 
    
    // Meal tracker history
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
