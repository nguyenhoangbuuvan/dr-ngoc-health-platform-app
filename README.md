# Dr Ngoc Health Platform App

Public demo dashboard for Dr Ngoc AI Health Platform.

## Cloudflare Pages

- Framework preset: `None`
- Build command: leave empty
- Build output directory: `/`
- Custom domain: `app.drngoc.com.vn`

## Supabase Auth

The app uses Supabase Auth and requires an active staff account in `public.staff_profiles`.

After the Cloudflare Pages domain is active, add these URLs in Supabase Auth URL configuration:

```text
https://app.drngoc.com.vn
https://app.drngoc.com.vn/*
```

Do not add secrets, service role keys, database passwords, or patient exports to this repository.
