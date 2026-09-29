# Thirsty Dreamer

A static, responsive personal website for Massimo “Massi” Zitti, based on the attached final HTML design. It keeps the supplied olive, clay, cream, and paper palette and serves the design's original WOFF2 display, hand-lettered, and body fonts locally. Its copy and media are editable through the existing Supabase-backed admin page.

## Deploy

This is a static website. The existing Vercel project can redeploy from the connected GitHub `main` branch after changes are pushed; no Vercel credentials are needed for the source update. The admin editor is at `/admin.html`.

## Supabase setup (one-time)

The page can render its bundled starter copy before Supabase is connected. The CMS, database-backed email signups, admin login, and Storage uploads require a Supabase project.

1. Create an administrator user in **Supabase → Authentication → Users**. Use an email you control and set a password. If email confirmation is enabled, confirm the account (or mark it confirmed in the Supabase dashboard).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in **Supabase → SQL Editor**. It creates the CMS tables, enables row-level security, creates the public media bucket, and limits browser writes to administrators.
3. After the existing schema succeeds, run [`supabase/contact-inbox.sql`](supabase/contact-inbox.sql) once in **Supabase → SQL Editor**. This additive migration creates the secure contact-inquiries table; it does not replace or reset your CMS, uploads, or sign-up tables. Visitors can insert valid inquiries, while only allowlisted admins can read or update inquiry status.
4. Add the Auth user to the admin allowlist. Run this separate SQL query, replacing the example email with the exact email shown in Supabase Auth:

   ```sql
   insert into public.cms_admins (user_id)
   select id from auth.users where lower(email) = lower('YOUR_ADMIN_EMAIL')
   on conflict (user_id) do nothing;
   ```

   It should insert one row. If it inserts zero, verify that the email matches a user in this Supabase project.
5. In **Supabase → Project Settings → API**, copy the project URL and its public **publishable key** (or legacy `anon` key). Put them in [`supabase-config.js`](supabase-config.js):

   ```js
   window.SUPABASE_CONFIG = {
     url: 'https://YOUR_PROJECT_REF.supabase.co',
     anonKey: 'YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY'
   };
   ```

6. Commit and push `supabase-config.js` to `main` to trigger the existing Vercel deployment. The publishable/anon key is intended for browser apps, but **the service-role/secret key must never go in website code**. Security comes from the SQL policies; do not skip those steps.
7. Open `https://thirsty-dreamer-final.vercel.app/admin.html`, sign in, edit the copy/media, and choose **Save changes** to publish. The first save publishes the included starter content into Supabase.

The media bucket is public-read so visitors can watch the site's videos; uploads and changes require an authenticated administrator. Resumable TUS upload is used for large files. The configured per-file limit is **50 MiB** (you can raise it in `supabase/schema.sql` if your Supabase plan and project settings allow more). Accepted formats: MP4, WebM, MOV, JPEG, PNG, WebP, and AVIF.

## What the CMS manages

- All website copy, headlines, section text, profile/bio paragraphs, journal stories, speaking topics, collaboration names, social highlights, signup copy, and public links.
- Add, remove, and reorder journal stories, videos, speaking topics, and social highlights.
- Upload/replace videos and posters, and replace the two portrait images.
- View and export the Dream Journal and Secret Diners sign-up list as CSV.
- View contact-form inquiries in the authenticated admin dashboard, change inquiry status, and export the inbox as CSV.

## Visitor interactions

- Mobile menu opens/closes and collapses after choosing a destination.
- Journal cards open an accessible story dialog.
- Contact and speaking calls to action bring the visitor to a required inquiry form (name, email, phone, topic, message, and reply-consent).
- Contact inquiries are stored in the private Supabase inbox and visible under **Website inquiries** in `/admin.html`; they are not automatically emailed. Public pages do not expose Massi's private email address or phone number.
- Dream Journal and Secret Diners forms validate their email address; when Supabase is connected, sign-ups are saved with an opt-in category.
- Admin-uploaded video files and portraits render on the public site; the video gallery remains hidden until a video is uploaded.

## Local preview

Serve the folder over HTTP (rather than opening files with `file://`) so `content.json` and browser scripts load correctly, for example:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080/`.

## Security and operations

- No user passwords or service-role keys are committed. Admin sign-in uses Supabase Auth; CMS writes, private signup/inquiry reads and status updates, and media uploads are restricted with PostgreSQL/Storage RLS policies.
- Run the SQL in a Supabase project you own. A public website key alone cannot bootstrap the administrator or create tables.
- New visitors can read public content and public media; only an admin can publish copy or upload media. The email-list table is not publicly readable.
- The supplied artwork is retained; optional CMS videos and replacement portraits are not shown until real media is uploaded.

Supabase implementation references: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), and [resumable uploads](https://supabase.com/docs/guides/storage/uploads/resumable-uploads).
