import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The gov web app runs on 5174; it talks to the gov API (default http://localhost:8081, set VITE_API_URL to change).
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5174, strictPort: true },
  preview: { host: true, port: 5174, strictPort: true },
});
