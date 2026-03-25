# `src/models/` — MongoDB Schemas (Mongoose)

This folder contains all **Mongoose model definitions**. Each file defines a schema and exports a cached model (using `mongoose.models.X || mongoose.model('X', XSchema)`) to be safe for Next.js hot reloading and serverless environments.

---

## Models

### `User.ts`
The authenticated user account.

| Field       | Type     | Notes                               |
|-------------|----------|-------------------------------------|
| `name`      | String   | Required                            |
| `email`     | String   | Required, unique                    |
| `password`  | String   | Hashed with bcrypt before save (`pre('save')`) |
| `createdAt` | Date     | Auto-added via `timestamps: true`   |
| `updatedAt` | Date     | Auto-added via `timestamps: true`   |

Has an instance method `comparePassword(candidate)` that uses `bcrypt.compare` for login validation.

---

### `Loan.ts`
Represents a loan product offered by the bank.

| Field           | Type    | Notes                                    |
|-----------------|---------|------------------------------------------|
| `id`            | String  | Unique product ID                        |
| `name`          | String  | e.g., "Standard Personal Loan"           |
| `interestRate`  | Number  | Annual interest rate (%)                 |
| `maxAmount`     | Number  | Maximum disbursable amount (₹)           |
| `tenureMonths`  | Number  | Repayment period in months               |
| `description`   | String  | Short description shown to the user      |

Fetched by the `getAvailableLoans` tool during the `loan_selection` stage.

---

### `KYC.ts`
Stores KYC verification data used to validate a user's identity.

Used by the `verifyKYC` tool: the tool looks up the provided Aadhaar + DOB combination in this collection to confirm identity. If no record is found, KYC fails.

---

### `Credit.ts`
Stores simulated credit score data keyed by PAN card number.

Used by the `getCreditScore` tool. In production this would integrate with a bureau API (CIBIL, Experian). In this prototype, records are seeded into MongoDB and looked up by PAN.

---

### `PolicyDocument.ts`
Stores chunked and embedded loan policy document data for RAG search.

| Field        | Type       | Notes                                      |
|--------------|------------|--------------------------------------------|
| `filename`   | String     | Source PDF filename                        |
| `chunkIndex` | Number     | Position of this chunk in the original doc |
| `text`       | String     | The raw text content of this chunk         |
| `embedding`  | [Number]   | Vector embedding for similarity search     |
| `uploadedAt` | Date       | Timestamp for fallback sorting             |

This collection **requires a MongoDB Atlas Vector Search index** (`vector_index_1`) on the `embedding` field. See `src/lib/embeddings/docs/README.md` for setup.

---

## Usage Pattern

All models follow the same Next.js-safe export pattern:

```ts
export default mongoose.models.ModelName || mongoose.model('ModelName', Schema);
```

This prevents the "Cannot overwrite model once compiled" error during hot reloads in development.
