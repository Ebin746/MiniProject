import mongoose from 'mongoose';

const CreditSchema = new mongoose.Schema({
    pan: {
        type: String,
        required: true,
        unique: true,
    },
    score: {
        type: Number,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    emi: {
        type: Number,
        required: true,
    },
}, { timestamps: true });

export default mongoose.models.Credit || mongoose.model('Credit', CreditSchema);
