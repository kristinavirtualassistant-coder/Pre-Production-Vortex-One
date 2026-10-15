# Vortex One marketing website

Static site (no build step), converted from the "Vortex One Website" design canvas, hosted on Vercel (free).
Vercel project settings: Root Directory `website`, Framework Preset `Other`, no build command, output `.`.

- `index.html`: the main page. The interactive samples (property and owner panel, AI caller, lead scoring, pipeline,
  time calculator) run in `assets/main.js` on fictional data, entirely in the browser.
- `privacy.html`, `terms.html`, `refund-cancellation.html`, `data-sources.html`, `cookies.html`, `call-recording.html`,
  `ai-disclosure.html`, `communications-policy.html`, `acceptable-use.html`: legal pages (`cleanUrls` serves them at
  `/privacy` etc.).
- `assets/site.css`: Vortex One design tokens and component classes.

Sign-up and sign-in buttons go to the platform at `vortex-one-web.onrender.com` (`?signup=1` opens the sign-up form);
switch them to `app.remoteaccountmanagers.online` once that domain is live. "Request a demo" is an email link: the site
has no backend, so it never shows a fake confirmation.
