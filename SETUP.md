# MindMesh - Project Setup & Deployment Guide

## 📋 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn package manager

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/archduke1337/mindmesh.git
   cd mindmesh
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Setup environment variables**
   - Copy `.env.example` to `.env.local`
   - Add your Appwrite credentials
   ```bash
   cp .env.example .env.local
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   - Visit `http://localhost:3000`

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. Push to GitHub
2. Visit [https://vercel.com](https://vercel.com)
3. Import your repository
4. Add Environment Variables:
   - `NEXT_PUBLIC_APPWRITE_PROJECT_ID`
   - `NEXT_PUBLIC_APPWRITE_PROJECT_NAME`
   - `NEXT_PUBLIC_APPWRITE_ENDPOINT`
   - `NEXT_PUBLIC_APPWRITE_DATABASE_ID`
   - `NEXT_PUBLIC_APPWRITE_BUCKET_ID`
5. Deploy!

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

## 📁 Project Structure

```
mindmesh/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Homepage
│   ├── api/               # API routes
│   └── [routes]/          # Page routes
├── components/            # Reusable React components
├── lib/                   # Utility functions & services
│   ├── appwrite.ts       # Appwrite configuration
│   ├── emailService.ts   # Email sending service
│   └── database.ts       # Database utilities
├── config/               # Configuration files
├── context/              # React context providers
├── styles/               # Global CSS
├── public/               # Static assets
├── types/                # TypeScript type definitions
└── [config files]        # next.config.js, tsconfig.json, etc.
```

## 🔧 Available Scripts

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm start             # Start production server
npm run lint          # Run ESLint
npm run vercel-build  # Build with legacy peer deps support
```

## 🔐 Environment Variables

All environment variables should be defined in one of:
- `.env.local` - Local development (git ignored)
- Vercel Dashboard - Production deployment

See `.env.example` for all required variables.

## 🛠️ Tech Stack

- **Framework:** Next.js 14
- **UI Components:** HeroUI (v2)
- **Styling:** Tailwind CSS
- **Database:** Appwrite
- **Email:** EmailJS
- **3D Graphics:** Three.js
- **Animation:** Framer Motion, GSAP
- **Language:** TypeScript

## 📝 Important Notes

1. **Never commit `.env` file** - It contains sensitive data
2. **Always use `.env.local` for local development**
3. **Environment variables in `.env.example` are templates** - Update with your actual values
4. **For Vercel deployment** - Add variables in project settings, not in code

## 🚨 Common Issues

### Build Fails
- Run `npm run build` locally first
- Check for TypeScript errors
- Ensure all dependencies are installed

### Appwrite Connection Issues
- Verify endpoint URL
- Check project ID and database ID
- Ensure CORS is enabled in Appwrite

### Missing Modules
- Delete `node_modules` and `.next`
- Run `npm install --legacy-peer-deps` again

## 📚 Documentation

- [Next.js Documentation](https://nextjs.org/docs)
- [Appwrite Documentation](https://appwrite.io/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 👥 Support

For issues or questions, create an issue in the GitHub repository.
