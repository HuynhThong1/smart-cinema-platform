# Deploy a Free Demo on Render

The root [`render.yaml`](../render.yaml) creates four connected services: a static admin site, the customer SSR app, the Go API, and Keycloak. MongoDB Atlas stores application data and Neon PostgreSQL stores Keycloak data. This setup is suitable for a demo or UAT environment.

## 1. Create the free databases

Create a MongoDB Atlas M0 cluster, then create a database user. In **Network Access**, allow `0.0.0.0/0` because free Render services do not have fixed outbound IPs. Use a long, unique database password. Copy the `mongodb+srv://...` driver URI and URL-encode special characters in its password.

Create a Neon Free project near Singapore. Copy these values from its direct connection string:

```text
KC_DB_URL=jdbc:postgresql://HOST/DATABASE?sslmode=require
KC_DB_USERNAME=USER
KC_DB_PASSWORD=PASSWORD
```

Replace the `postgresql://` prefix with `jdbc:postgresql://` and remove `USER:PASSWORD@` from `KC_DB_URL`. Keep `sslmode=require`. See [`deploy/render.env.example`](../deploy/render.env.example) for the complete input list.

## 2. Create the Render Blueprint

1. Sign in to Render and choose **New > Blueprint**.
2. Connect `HuynhThong1/smart-cinema-platform`, select branch `main`, and keep the detected `render.yaml` path.
3. Enter the requested secrets:
   - `MONGODB_URI` for `smart-cinema-api`.
   - `KC_DB_URL`, `KC_DB_USERNAME`, and `KC_DB_PASSWORD` for Keycloak.
   - A new Keycloak console username and password.
   - One new password of at least 12 characters for `DEMO_USER_PASSWORD`.
4. Click **Apply**. Render generates the remaining secrets and connects the service URLs automatically.

[Deploy the repository on Render](https://render.com/deploy?repo=https://github.com/HuynhThong1/smart-cinema-platform)

## 3. Verify the deployment

Wait until all four services show **Live**. On the free plan, Keycloak can take several minutes to build and the first API deploy might need **Manual Deploy > Deploy latest commit** after Keycloak becomes live.

Check these endpoints in order:

```text
https://smart-cinema-keycloak.onrender.com/realms/smart-cinema
https://smart-cinema-api.onrender.com/readyz
https://smart-cinema-admin.onrender.com
https://smart-cinema-customer.onrender.com
```

Sign in to Admin as `manager`, `manager2`, `headoffice`, or `sysadmin` with `DEMO_USER_PASSWORD`. Open **Quản lý QR**, copy a generated customer URL, submit feedback, then confirm it appears in Admin.

## Free-tier behavior

Render gives each workspace 750 free web-service hours per month. A free service sleeps after 15 minutes without inbound traffic and can take about one minute to wake. This stack runs three web services, so use it for occasional demos rather than continuous traffic. Atlas and Neon retain the databases independently of Render restarts; service filesystems remain ephemeral.

After UAT, set `SEED_DEVELOPMENT=false`, replace demo accounts, restrict Atlas network access where your hosting plan permits fixed egress, and move Keycloak/API to paid instances before production use.

## Troubleshooting

- **API cannot start:** verify Atlas network access, database credentials, and the `MONGODB_URI` encoding.
- **Keycloak cannot start:** use the direct Neon host, confirm the JDBC prefix, and keep `sslmode=require`.
- **Admin login loops:** confirm all services were created by the same Blueprint, then redeploy Admin after Keycloak is live.
- **First request is slow or returns 503:** wake Keycloak and API first by opening the realm and readiness URLs above.
