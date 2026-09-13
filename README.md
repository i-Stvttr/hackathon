# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

##  Problem

Traditional credit scoring systems in Mexico are static and exclusionary. Many students, freelancers, and independent professionals struggle to access their first credit card because they lack a traditional credit history, a fixed salary, or the required employment seniority.

Even when they have consistent income and responsible financial habits, their financial reliability may not be properly reflected by traditional credit evaluation systems.

---

##  Solution

**CapiFrog** is a proactive financial assistant that analyzes users' real-time cash flow to distinguish between reliable income, such as recurring clients or payroll, and variable income, such as one-time projects or commissions.

Based on this analysis, CapiFrog:

-  Calculates how much the user can safely save without affecting their liquidity.
-  Detects potential money leaks, such as forgotten or duplicate subscriptions.
-  Generates a **Credit Readiness Score (0–100)** based on responsible financial behavior.
-  Evaluates income reliability and financial stability.
-  Detects early signs of financial risk.
-  Provides personalized actions to help users improve their financial profile over time.
-  Uses **Google Gemini** to explain financial insights in simple, natural language.

> CapiFrog complements traditional credit history by providing additional evidence of responsible day-to-day financial behavior.

---

##  Technologies Used

| Technology | Purpose |
|------------|---------|
|  **React 19.2** | Frontend framework |
|  **TypeScript 5.7** | Type-safe application development |
|  **Vite 8** | Development and build tool |
|  **Tailwind CSS 4** | Responsive and mobile-first UI styling |
|  **Python** | Backend and financial data processing |
|  **FastAPI** | Backend API framework |
| **Google Gemini** | AI-powered financial explanations through the *Ask Me* feature |
|  **Figma** | UI/UX design and prototyping |
|  **GitHub** | Version control and project collaboration |
|  **ESLint 10** | Code quality and linting |
|  **Vercel** | Frontend deployment and hosting |
| **Render** | Backend deployment and API hosting |

---

##  Deployment

The **CapiFrog frontend** was deployed using **Vercel**, while the **backend and API** were deployed using **Render**, allowing both parts of the application to work together in a production environment.

---

### 🐸 CapiFrog

**Making financial behavior visible, understandable, and credit-ready.**
