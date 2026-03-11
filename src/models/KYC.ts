import mongoose from 'mongoose';

const KYCSchema = new mongoose.Schema({
    aadhar_no: {
        type: String,
        required: true,
        unique: true,
    },
    dob: {
        type: String,
        required: true,
    },
    full_name: {
        type: String,
        required: true,
    },
}, { timestamps: true });

export default mongoose.models.KYC || mongoose.model('KYC', KYCSchema);
