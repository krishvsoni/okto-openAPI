# Okto SDK React Template

This is a React + Vite template pre-configured with [Okto SDK](https://docs.okto.tech/) for building chain abstracted decentralized applications. It provides a solid foundation for creating Web3-enabled applications with best practices and essential tooling.

## Features

- ⚡️ **React + Vite** for lightning-fast development
- 🔐 **Okto SDK** integration for seamless Web3 functionality
- 📱 **Responsive Design** out of the box

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18.x or later and npm/pnpm/yarn
- **Okto API Keys:** `VITE_CLIENT_PRIVATE_KEY` and `VITE_CLIENT_SWA`. Obtain these from the [Okto Developer Dashboard](https://dashboard.okto.tech/login).
- Google OAuth Credentials

## Getting Started

1. Clone this template:
   ```bash
   git clone https://github.com/okto-hq/okto-sdkv2-react-template-app.git
   cd okto-sdkv2-react-template-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables:
   ```bash
   cp .env.sample .env
   ```
   Edit `.env` and add your Okto API credentials:

    ```title=".env"
    # The Okto environment "sandbox" or "production"
    VITE_OKTO_ENVIRONMENT= "sandbox"

    # Get the below values from Okto Developer Dashboard. Learn how here- https://docsv2.okto.tech/docs/developer-admin-dashboard
    VITE_OKTO_CLIENT_PRIVATE_KEY= "YOUR_CLIENT_PRIVATE_KEY"
    VITE_OKTO_CLIENT_SWA= "YOUR_CLIENT_SWA"

    # Only needed if google authentication is used
    VITE_GOOGLE_CLIENT_ID= "YOUR_GOOGLE_CLIENT_ID"
    ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) with your browser to see your application.

## Deployment

This template can be deployed to any static hosting service. Some popular options include:

- [Vercel](https://vercel.com)
- [Netlify](https://netlify.com)

Follow the respective platform's documentation for deployment instructions.

## Learn More

- [Okto SDK Documentation](https://docs.okto.tech/)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)

## Contributing

Contributions are welcome! Please take a moment to review our [CONTRIBUTING.md](CONTRIBUTING.md) guidelines before submitting any Pull Requests. Your contributions are invaluable to the Okto community.
