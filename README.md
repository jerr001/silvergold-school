# Silvergold British High School website

The original public site remains plain HTML, CSS and browser JavaScript. Express serves those pages and provides a same-origin REST API. MongoDB stores administrator accounts, articles, media metadata, applications and contact messages. Cloudinary stores image and video files.

## Requirements

- Node.js 20 or newer and npm
- MongoDB locally or a MongoDB Atlas connection string
- A Cloudinary account for dashboard media uploads

## Local setup

1. Install packages with `npm install`.
2. Copy `.env.example` to `.env` and set `MONGODB_URI` and a random `SESSION_SECRET` containing at least 32 characters.
3. Verify the database with `npm run check-db`, then create the first administrator with `npm run create-admin`. In an interactive terminal, the command asks for the email and a hidden password (at least 12 characters). Alternatively, set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the process environment before running it. This command creates or resets that administrator; it does not start a web registration endpoint.
4. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to `.env` to enable media uploads. The server defaults to 8 MB per image and 100 MB per video; adjust `MAX_IMAGE_MB` and `MAX_VIDEO_MB` as needed.
5. Run `npm run dev` for local development or `npm start` to serve the site at `http://localhost:3000`. Sign in at `/admin/login.html`.

After setting `MONGODB_URI`, verify the connection with `npm run check-db` before creating the first administrator.

The site uses same-origin API calls, so local development, production, and a reverse proxy do not need separate frontend API URLs. When deployed behind a TLS reverse proxy, serve HTTPS and configure the hosting proxy to forward requests to the Node process. Do not expose the Node port directly to the public internet.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Set to `production` for production cookie settings. |
| `PORT` | HTTP port (defaults to 3000). |
| `MONGODB_URI` | MongoDB connection string. Keep credentials private. |
| `SESSION_SECRET` | Random secret with 32 or more characters. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Used only by the one-time/maintenance `create-admin` command; never put these in browser configuration. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Private managed media storage credentials. |
| `MAX_IMAGE_MB`, `MAX_VIDEO_MB` | Maximum size allowed for each uploaded file. |

## Administration

The dashboard is at `/admin/`. It supports news drafts and publishing, gallery image uploads and captions/categories, video uploads, status updates for admissions and contact messages, search, summary counts, and CSV exports. Public endpoints only return published news, images and videos. Student and contact records require an authenticated administrator session.

To add or reset an administrator safely, configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the server environment and run `npm run create-admin` against the same database. There is no public account-creation route. Keep environment files out of version control. Store database backups outside the application host and periodically test restoring them in a separate database.

## Deployment and recovery

Deploy to a Node.js host that supports a persistent process and environment variables (for example, a managed Node service or container platform), with HTTPS termination, MongoDB network access restricted to the application, and Cloudinary credentials configured. A static-only host cannot run the API; it must proxy the existing public pages and `/api/*` routes to the Node service, or the site must be served by this Express application. Uploads live in Cloudinary, not on ephemeral server disk. Use MongoDB Atlas automated backups or scheduled `mongodump` backups and periodically verify recovery with `mongorestore` to a separate database.

## Troubleshooting

- **Startup says `MONGODB_URI` is required:** set it in `.env` or the deployment environment and check MongoDB connectivity/firewall rules.
- **Startup rejects the session secret:** set `SESSION_SECRET` to a new random string of at least 32 characters.
- **Sign-in fails:** run the `create-admin` command with the correct database URI and administrator environment variables, then sign in using that email/password.
- **Upload says media storage is not configured:** set all three Cloudinary credentials and restart the server.
- **Large upload is rejected:** reduce the file size or raise the corresponding upload limit. Check the hosting platform's request-size limit as well.

## Security notes

Production must use HTTPS (`NODE_ENV=production`) so session cookies are secure. Keep MongoDB, session and Cloudinary secrets server-side. Limit administrator access to trusted school staff, rotate credentials if exposed, and review applicable student-data retention and privacy policies before collecting real applications.
