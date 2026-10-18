# Hosting the Gauntlet on GitHub Pages

GitHub Pages serves static files, so shared match data and private editing need a backend. This app uses Supabase for shared storage, live updates, and database-enforced read-only access. Visitors can view the match without signing in; the configured GitHub account is the only editor.

## 1. Create the Supabase project

Create a project at [supabase.com](https://supabase.com). In **Project Settings → API**, copy the project URL and the public anon/publishable key into `config.js`:

```js
export const config = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_ANON_KEY",
  adminUserId: "",
};
```

The URL and anon/publishable key are intended for browser use. **Never use the `service_role` key** in this website or commit it to GitHub.

## 2. Enable GitHub sign-in

1. Create a GitHub OAuth App in **GitHub → Settings → Developer settings → OAuth Apps**.
2. Set its authorization callback URL to `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
3. In Supabase, open **Authentication → Sign In / Providers → GitHub**, enable GitHub, and enter the OAuth App's client ID and client secret.
4. In **Authentication → URL Configuration**, set the site URL to your GitHub Pages address, for example `https://YOUR_GITHUB_NAME.github.io/YOUR_REPOSITORY/`. Add that same address under the allowed redirect URLs. Add your local development URL there too if you use one.

## 3. Create the shared match and secure its writes

Sign in to the site once with the GitHub account that should own editing. In Supabase, open **Authentication → Users**, find that GitHub user, and copy its Supabase user UUID.

In `supabase-setup.sql`, replace both occurrences of `YOUR_SUPABASE_USER_UUID` with that UUID. Run the complete SQL file in the Supabase **SQL Editor**. The script creates the shared match row, enables real-time updates, permits public reads, and permits updates only from that UUID.

Put the same UUID in `adminUserId` in `config.js`:

```js
adminUserId: "YOUR_SUPABASE_USER_UUID",
```

The UUID in the browser config only controls which account sees the editing controls. The database row-level security policy is what actually prevents other accounts and visitors from changing match data.

## 4. Publish with GitHub Pages

1. Create a GitHub repository and add the website files, including `.github/workflows/pages.yml`.
2. Push the files to the repository's `main` branch.
3. In the repository, open **Settings → Pages** and set the build/deployment source to **GitHub Actions**.
4. Wait for the **Deploy GitHub Pages** workflow to complete. Your site will be available at `https://YOUR_GITHUB_NAME.github.io/YOUR_REPOSITORY/`.

Subsequent pushes to `main` automatically publish website changes. Match picks and scores are stored separately in Supabase and synchronize live for everyone viewing the page.

## Game formats

The lineup shows each game as its own card. The 5v5 games use the drafted teams directly. 2XKO and Mahjong let the admin choose the players for two 2v2 sets and one 1v1; each set has its own result and the overall game is awarded to the first team to win two sets. Minecraft Manhunt lets the admin select one player against four opponents. For Honour and Chess let the admin set both team queues, choose the starting king's team, and record each fight until one team runs out of players.

After both teams have four drafted athletes (five players including each captain), the draft pool can be hidden with the toggle above it. If a drafted player is moved or removed, special-game lineups and results are cleared so no match keeps stale player selections.

## Notes

- The `Reset match` button is only shown to the configured administrator.
- If the page shows **SETUP REQUIRED**, check that `config.js` contains the Supabase URL and public anon/publishable key.
- If it shows a connection or sync error, confirm the SQL setup, GitHub provider callback, allowed redirect URL, and Supabase project status.
- Keep `supabase-setup.sql`'s update policy restricted to your own UUID. Never add a public update policy.
