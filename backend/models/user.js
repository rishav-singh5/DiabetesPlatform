const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    paymentAccess: {
        hasPaid: {
            type: Boolean,
            default: false
        },
        paidAt: Date,
        razorpayOrderId: String,
        razorpayPaymentId: String
    }
})

module.exports = mongoose.model("User", userSchema)
