const mongoose = require("mongoose");

const ChatSchema = new mongoose.Schema({
    user_id: { type: String, required: true },
    message: { type: String, required: true },
    response: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Chat", ChatSchema);
