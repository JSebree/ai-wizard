# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Release Process

The following is the full release workflow used for promoting changes from development → main → stable, tagging releases, and ensuring reproducible builds.

### **1. Commit All Local Changes**

```bash
git add .
git commit -m "your message here"
```

### **2. Push to `main`**

```bash
git push -u origin main
```

### **3. Tag the Stable Release**

Choose the next version number (semantic versioning):

```bash
git tag -a v0.3.0 -m "Stable release: character & setting studios wired to Supabase"
git push origin v0.3.0
```

### **4. Create / Update the `stable` Branch**

If the branch does not yet exist:

```bash
git checkout -b stable
git push -u origin stable
```

If it already exists and you want to update it to the newest main:

```bash
git checkout stable
git merge main
git push
```

### **5. (Optional) Open a Pull Request**

If you prefer PR-based merging, GitHub will suggest a PR link:

```
https://github.com/<your-username>/<repo>/pull/new/stable
```

### **6. Deployment Notes**

- Cloudflare Pages will deploy whatever branch you configure (usually `main` or `stable`).
- Environment variables (`.env`, `.env.local`) are NOT committed—update them manually in Cloudflare.
- Supabase client changes require updating Cloudflare env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

### **7. Summary**

1. Develop locally  
2. Commit → push to **main**  
3. Tag release (`v0.x.x`)  
4. Push tag  
5. Update/create **stable** branch  
6. Push stable  
7. Deployment picks up automatically  

This ensures a clean deployment pipeline with predictable stable releases.
