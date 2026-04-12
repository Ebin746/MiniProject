import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        index: true,
        lowercase: true,
        trim: true,
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
    },
    encryptedPan: {
        type: String,
        default: '',
    },
    encryptedAadhaar: {
        type: String,
        default: '',
    },
    hasVerifiedPan: {
        type: Boolean,
        default: false,
    },
    hasVerifiedKyc: {
        type: Boolean,
        default: false,
    },
    lastCreditScore: {
        type: Number,
        default: null,
    },
    lastFoir: {
        type: Number,
        default: null,
    },
 


}, { timestamps: true });

UserSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidatePassword: string) {
    return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.models.User || mongoose.model('User', UserSchema);
