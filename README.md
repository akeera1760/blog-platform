# Blog Platform

A React + TypeScript blog platform using Vite, Tailwind CSS, and Supabase for authentication, storage, and database.

## Features

- User sign up, login, and profile management
- Create posts with image upload
- Display post feed with user avatars
- Like posts
- Comment on posts
- Supabase storage for post images and profile avatars

## Local Setup

1. Install dependencies

```bash
npm install
```

2. Create a `.env` file at the project root with your Supabase values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. Start the development server

```bash
npm run dev
```

4. Open the app

Visit `http://localhost:5175`

## Supabase Requirements

- Auth enabled for email/password sign in
- Storage buckets:
  - `post-images` (public)
  - `avatars` (public)
- Database tables:
  - `profiles`
  - `posts`
  - `comments`
  - `likes`

## Important Files

- `src/main.tsx` - app entry point
- `src/App.tsx` - router and layout
- `src/lib/supabase.ts` - Supabase client setup
- `src/lib/api.ts` - API helper functions for auth, posts, comments, likes, and file uploads
- `src/pages/CreatePost.tsx` - post creation with image upload
- `src/components/PostCard.tsx` - post feed card component
- `src/contexts/AuthContext.tsx` - authentication state

## Build

```bash
npm run build
```

## Notes

- Image upload uses Supabase Storage and public URLs.
- If images fail to upload, verify bucket permissions and that the public URL is generated correctly.
