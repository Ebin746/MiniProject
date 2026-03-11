# 🏦 Loan Assistant: AI-Powered Financial Orchestrator

[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Mastra](https://img.shields.io/badge/Mastra-AI-indigo?style=for-the-badge)](https://mastra.ai/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

**Loan Assistant** is a production-grade, multi-stage AI application designed to streamline the loan eligibility and application process. Using advanced AI orchestration and OCR technology, it guides users from initial inquiry to final document generation with a seamless, conversational interface.

---

## ✨ Key Features

- **🤖 Intelligent Multi-Agent System**: Powered by Mastra and Groq, our agent dynamically manages the loan lifecycle.
- **📄 OCR Data Extraction**: Built-in document processing (Tesseract.js) to extract financial info from IDs and salary slips.
- **🔄 Multi-Stage Workflow**: A state-aware session manager handles Sales, KYC, Credit Assessment, and Loan Selection.
- **📊 Real-time Financial Analysis**: Instant FOIR (Fixed Obligation to Income Ratio) calculations and credit score assessment.
- **🖨️ Automated PDF Generation**: Professional loan application PDFs generated on-the-fly via PDFKit.
- **🔐 Secure Authentication**: JWT-based session management and secure MongoDB persistence.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4, Lucide React.
- **AI Backend**: Mastra (Agentic Framework), Groq / DeepSeek LLMs.
- **Database**: MongoDB with Mongoose ODM.
- **Tools**: Tesseract.js (OCR), PDFKit (Document Generation).
- **Environment**: Node.js with TypeScript and `tsx`.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+)
- MongoDB instance (Local or Atlas)
- Groq API Key

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd MiniProject
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   Create a `.env` file in the root and add the following:
   ```env
   MONGODB_URI=your_mongodb_uri
   GROQ_API_KEY=your_groq_api_key
   JWT_SECRET=your_super_secret_key
   ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 In-Depth Documentation

For detailed technical information, please refer to the following guides:

- 🏛️ **[Technical Architecture](./docs/ARCHITECTURE.md)**: Layered design, Mastra orchestration, and integration patterns.
- 📂 **[Project Structure & File Guide](./docs/FILES.md)**: Detailed map of the codebase and file responsibilities.
- 🌊 **[Data Flow & Workflow](./docs/DATA_FLOW.md)**: Visual guides for the loan lifecycle and OCR processing.

---

## 🤝 Contributing

We welcome contributions! Please follow the standard workflow:
1. Fork the repo.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
