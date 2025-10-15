# TechSavy App

This project contains the Vite React frontend. The Google Sheets / Drive integration has been migrated to a Google Apps Script web app.

Apps Script web app

1. Deploy the Apps Script from `apps-script/Code.gs` as a Web App (see `apps-script/README.md` for steps).
2. Set the frontend environment variable `VITE_APPS_SCRIPT_URL` to your deployed Web App URL.

Optional: if you want the Apps Script to pull registrations directly from Supabase, set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in the script's Project Properties (see `apps-script/README.md`).
