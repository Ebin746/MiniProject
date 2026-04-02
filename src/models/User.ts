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
    profile: {
        monthlyIncome: {
            type: Number,
            default: null,
        },
    },
    documents: {
        aadhaarNo: {
            type: String,
            default: null,
        },
        dob: {
            type: String,
            default: null,
        },
        pan: {
            type: String,
            default: null,
        },
    },
    verification: {
        hasVerifiedKyc: {
            type: Boolean,
            default: false,
        },
        hasVerifiedPan: {
            type: Boolean,
            default: false,
        },
        eligibleApproved: {
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
        lastEligibleAt: {
            type: Date,
            default: null,
        },
    },


}, { timestamps: true });

UserSchema.pre('save', async function (this: any) {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (this: any, candidatePassword: string) {
    return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.models.User || mongoose.model('User', UserSchema);
