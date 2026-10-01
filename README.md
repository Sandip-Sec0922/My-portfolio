# SOC Portfolio

## Run with Docker

1. Copy `.env.example` to `.env`.
2. Replace every `change_me` value with a unique random value.
3. Set `CORS_ORIGINS=http://localhost`.
4. Start the stack:

```sh
docker compose up --build
```

Open <http://localhost>. The API health endpoint is available at
<http://localhost/api/health>.

The first boot creates the admin account from `ADMIN_BOOTSTRAP_EMAIL` and
`ADMIN_BOOTSTRAP_PASSWORD`. Remove those bootstrap variables after signing in
and changing the password.

### Use MongoDB Atlas

Set `MONGO_URI` in your local, untracked `.env` file to the Atlas connection
string and include the database name in its path, for example:

```text
MONGO_URI=mongodb+srv://<db-user>:<url-encoded-password>@<cluster-host>/soc_portfolio?retryWrites=true&w=majority
```

URL-encode reserved characters in the database user's password and allow the
Docker host's outbound IP in Atlas Network Access. Restart the API services
with `docker compose up -d --build api1 api2 api3`. Accepted contact submissions
are stored as `messages` documents in the configured database; they are also
available from the authenticated Admin > Messages page and expire after 180
days.

### Deploy the frontend to Vercel

The root `vercel.json` builds the Vite app from `client` and proxies `/api/*`
requests to the Docker-hosted API. Replace
`replace-with-public-api-host.invalid` with the public HTTPS API hostname before
deploying. Configure `CORS_ORIGINS` on the API with the Vercel deployment
origin. Keep the API, MongoDB URI, Redis URL, and auth secrets on the backend;
never put them in Vercel's client-side environment variables.

## Local checks

```sh
cd server && npm test
cd server && npm run lint
cd client && npm run build
```
