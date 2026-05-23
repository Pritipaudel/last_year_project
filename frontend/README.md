# AECS - Adaptive Exercise Coach System (Frontend)

Welcome to the frontend repository for AECS (Adaptive Exercise Coach System). AECS is a medical-grade, highly personalized fitness tracker designed to build safe and effective exercise regimens catered uniquely to an individual's biomechanics, equipment availability, and personal goals.

This project uses a modern web stack structured for high performance, smooth animations, and clean state management.

## 🚀 Tech Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **State Management**: Zustand
- **Routing**: React Router v7
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React

## 📦 Features

- **Dynamic Onboarding Engine**: A multi-step flow capturing age, BMI metrics, goals, and camera permission for real-time exercise correction.
- **State-of-the-art UI**: A premium, steel-blue color palette with modern glassmorphism, responsive split-screen layouts, and smooth transition animations (powered by `framer-motion`).
- **Privacy First**: Fully client-side capture pipeline (camera permissions + local silhouette analysis placeholder) to protect user images and models.
- **Robust Role Routing**: Guarded authenticated and public routes redirecting logic sequentially through dashboards and profile systems.

## 🛠 Project Structure

```text
frontend/
├── src/
│   ├── components/      # Reusable UI elements (Button, Card, Input) & layouts
│   ├── constants/       # Global constants (routes, navigation configs)
│   ├── hooks/           # Custom React hooks (useAuth, useMediaQuery)
│   ├── layouts/         # AppLayout and OnboardingLayout wrappers
│   ├── pages/           # Application views (Dashboard, Workout, Onboarding flows)
│   ├── routes/          # Core routing logic, Private/Public boundaries
│   ├── services/        # API integrations, auth mocks
│   ├── store/           # Zustand stores (useAuthStore, useUIStore, useOnboardingStore)
│   ├── styles/          # Global styles & robust css variable token-based theme
│   └── lib/             # Utility helpers (clsx/tailwind-merge wrapper)
```

## 💻 Getting Started

Ensure you have Node.js installed, then follow these steps:

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`.

3. **Build for production**:
   ```bash
   npm run build
   ```

## 🎨 Theme System

AECS uses a custom CSS variable-backed design system mapped alongside Tailwind utilities. Core colors are located in `src/styles/theme.css`, configured out-of-the-box with our customized "Steel Blue" aesthetic ensuring clean contrast and high-end gradients.
