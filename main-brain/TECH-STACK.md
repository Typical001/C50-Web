# Tech stack — Web app and shared backend

Last consolidated: 2026-11-09. Local source/configuration reviewed; historical test and hosted observations are dated below. This documentation pass did not rerun application tests or inspect live services.

Source: [package.json](../package.json), [package-lock.json](../package-lock.json), [.env.example](../.env.example). Values below are declared manifest ranges, not a claim that every package is used or that every installed version matches. Use the lockfile for reproducible resolution.

## Declared dependencies

| Package | Manifest range |
| --- | --- |
| @google/genai | ^2.4.0 |
| @supabase/supabase-js | ^2.110.3 |
| @tailwindcss/vite | ^4.1.14 |
| @videojs/react | ^10.0.0-beta.25 |
| @vitejs/plugin-react | ^5.0.4 |
| dotenv | ^17.2.3 |
| express | ^4.21.2 |
| lucide-react | ^0.546.0 |
| motion | ^12.23.24 |
| razorpay | 2.9.8 (added 2026-11-12) |
| react | ^19.0.1 |
| react-dom | ^19.0.1 |
| vite | ^6.2.3 |

## Declared development dependencies

| Package | Manifest range |
| --- | --- |
| @types/express | ^4.17.21 |
| @types/node | ^22.14.0 |
| autoprefixer | ^10.4.21 |
| esbuild | ^0.25.0 |
| tailwindcss | ^4.1.14 |
| tsx | ^4.21.0 |
| typescript | ~5.8.2 |
| vite | ^6.2.3 |

## Commands

Run in this app directory after installing dependencies with `npm ci`.

| Script | Actual command |
| --- | --- |
| npm run dev | tsx server.ts |
| npm run build | vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs |
| npm run start | node dist/server.cjs |
| npm run preview | vite preview |
| npm run clean | rm -rf dist server.js |
| npm run lint | tsc --noEmit |
| npm run test:payments | tsx --test server/payments.test.ts server/payment-client.test.ts |
| npm run test:recovery | tsx --test server/recovery.test.ts |

## Configuration

Server: `APP_URL`, `PORT`, `NODE_ENV`, `CORS_ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SESSION_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`. Browser: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

Keep real values in ignored local environment files or the deployment platform. All VITE_/EXPO_PUBLIC_ values are client-visible; no backend secrets belong there. Package installation is not evidence of a configured product feature. See [workflows](WORKFLOWS.md) for release commands and checks.
