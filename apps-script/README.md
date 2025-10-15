Apps Script web app

What this is

- `Code.gs` contains a Google Apps Script web app that implements three actions:
  - `createEvent`: create a spreadsheet named after the event and create tabs for problem statements with headers
  - `appendRegistration`: append a single registration row to a specific spreadsheet/tab
  - `exportFromSupabase`: optional - fetch registrations from Supabase (requires SUPABASE_URL and SUPABASE_SERVICE_KEY script properties) and write them into a spreadsheet tab

How to deploy

1. Open Google Apps Script (script.google.com) and create a new project.
2. Copy the contents of `apps-script/Code.gs` into the script editor.
3. In "Project Settings" > "Script properties", optionally add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` if you want Apps Script to fetch registrations directly.
4. Deploy > New deployment > Select "Web app". Set "Execute as" to "Me" and access to the desired level. Deploy and copy the Web App URL.
5. Set `VITE_APPS_SCRIPT_URL` in your `.env` (or environment provider) to the Web App URL you copied.

Notes

- The Apps Script runs under your Google account; spreadsheets will be created in the account that deployed the script.
- For security, prefer adding the Supabase service key as a script property rather than embedding in client code.
- This repo previously used server-side googleapis. That logic is removed in favor of the Apps Script web app.
