/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_STRIPE_PUBLIC_KEY: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_LINKEDIN_CLIENT_ID?: string;
  readonly VITE_ENABLE_RECRUITER_AGENT_ARENA?: string;
  readonly VITE_ENABLE_FEED?: string;
  readonly VITE_ENABLE_CLAUDE_CONNECTOR?: string;
  readonly VITE_ENABLE_APPLYPILOT_COACH?: string;
  // Add other env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
