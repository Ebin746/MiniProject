import { Memory } from '@mastra/memory';
import { MongoDBStore } from '@mastra/mongodb';

// ── Read env vars FIRST ───────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB_NAME;

if (!MONGODB_URI) throw new Error('MONGODB_URI missing from .env');
if (!MONGODB_DB) throw new Error('MONGODB_DB_NAME missing from .env');

// ── Storage ───────────────────────────────────────────────────────
const storage = new MongoDBStore({
  url: MONGODB_URI,
  dbName: MONGODB_DB,
});

// ── Memory ────────────────────────────────────────────────────────
export const memory = new Memory({
  storage,
  options: {
    workingMemory: {
      enabled: true,
      scope: 'resource',
      template: `# WORKING MEMORY
## User Profile
- Name:
- Monthly Income:
- Aadhaar NO:
- Date of Birth:
- PAN Card:
## Application Status
- Current Stage:
- KYC Status:
- Credit Score:
- FOIR:
- Selected Loan:
- Confirmation PDF:
`,
    },
    lastMessages: 8,
  },
});
