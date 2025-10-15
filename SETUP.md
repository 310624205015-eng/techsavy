# Google Sheets Integration Setup

## Environment Variables

### Client-Side (.env)
Only public environment variables that are safe to expose in the browser:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Server-Side (Vercel/Server Secrets)
These must be set in your deployment platform's secrets/environment variables:
```
GOOGLE_CLIENT_EMAIL=your_service_account_email
GOOGLE_PRIVATE_KEY=your_private_key
```

## Deployment Instructions

### Vercel Deployment
1. Push your code to GitHub
2. Create a new project in Vercel
3. Connect it to your repository
4. Add environment variables in Vercel:
   - Go to Project Settings > Environment Variables
   - Add `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY`
   - These will be securely stored and only accessible server-side

### Local Development
1. Create a `server.env` file (copy from `server.env.example`)
2. Add your Google service account credentials
3. Never commit the actual `server.env` file to version control

## Security Notes
- Never expose Google service account credentials in client-side code
- Always use server-side environment variables for sensitive credentials
- Variables prefixed with `VITE_` are exposed to the browser
- Keep service account permissions limited to only necessary scopes