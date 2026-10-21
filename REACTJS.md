# Use the Oraculo backend from Next.js and Tailwind

This API is Amplify Gen 2 (AppSync, DynamoDB, and the existing S3 bucket `ts-oraculo-models`). A Next.js App Router app talks to it with `aws-amplify`. Tailwind styles the UI. The backend stays in this repo. The Next.js app is a separate project.

| Mode | `authMode` | Who | Operations |
|---|---|---|---|
| Cognito user pool (default) | `userPool` | Signed-in user of pool `us-east-1_D6a0Qt0RG` | create, read, update, delete |
| API key | `apiKey` | Anyone with the key in `amplify_outputs.json` | read |

Storage (`models/*` and `analysis/*`) requires a signed-in user. The API key does not authorize S3.

Current sandbox (the URL changes if the sandbox is recreated):

- GraphQL: `https://lfl7wnxzvjdnzfhdm5ymn4xjum.appsync-api.us-east-1.amazonaws.com/graphql`
- Region: `us-east-1`
- User pool: `us-east-1_D6a0Qt0RG`
- Web client: `4c8sqf7jr0534shtd8jpqeb52a`
- Bucket: `ts-oraculo-models`

Copy connection details from `amplify_outputs.json` after `npm run sandbox`. Do not paste the API key into source files. Import the JSON file instead.

## 1. Create the Next.js app

From the directory where the frontend should live:

```sh
npx create-next-app@latest oraculo-web --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd oraculo-web
npm install aws-amplify @aws-amplify/adapter-nextjs
```

`create-next-app` with `--tailwind` writes `src/app/globals.css` and loads it from `src/app/layout.tsx`. Leave that setup in place. Use Tailwind classes on the components below.

Copy the backend output into the Next.js app:

```sh
cp /path/to/ts_be_oraculo_api_gen2/amplify_outputs.json src/amplify_outputs.json
```

`tsconfig.json` from `create-next-app` already has `resolveJsonModule`, so the JSON import type-checks.

Users sign in with the **username** of pool `us-east-1_D6a0Qt0RG`, not with email as the username. Email is a required attribute. MFA is optional (TOTP). Password minimum length is 8.

## 2. Configure Amplify once

`src/components/ConfigureAmplify.tsx`:

```tsx
'use client';

import { Amplify } from 'aws-amplify';
import outputs from '@/amplify_outputs.json';

Amplify.configure(outputs, { ssr: true });

export function ConfigureAmplify() {
  return null;
}
```

`src/app/layout.tsx` (keep the Tailwind stylesheet import):

```tsx
import type { ReactNode } from 'react';
import { ConfigureAmplify } from '@/components/ConfigureAmplify';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased">
        <ConfigureAmplify />
        {children}
      </body>
    </html>
  );
}
```

`Amplify.configure` runs at module load on the client, before child components call the API.

## 3. Data client

Typed calls need the backend `Schema`. Point the Next.js app at this repo's data file.

In the Next.js `tsconfig.json` `compilerOptions.paths`:

```json
{
  "@oraculo/schema": ["../ts_be_oraculo_api_gen2/amplify/data/resource.ts"]
}
```

Adjust the relative path to where this backend is checked out. Add the backend packages used by that file as dev dependencies of the Next.js app:

```sh
npm install --save-dev @aws-amplify/backend
```

`src/lib/client.ts`:

```ts
'use client';

import { generateClient } from 'aws-amplify/data';
import type { Schema } from '@oraculo/schema';

export const client = generateClient<Schema>();

export const publicClient = generateClient<Schema>({
  authMode: 'apiKey',
});
```

`client` uses the signed-in user pool token. `publicClient` uses the API key and can only read.

### Read without signing in

`src/app/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { publicClient } from '@/lib/client';

type Project = {
  id: string;
  name?: string | null;
  status?: string | null;
};

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    publicClient.models.Project.list().then(({ data, errors }) => {
      if (errors?.length) {
        setError(errors.map((item) => item.message).join('\n'));
        return;
      }
      setProjects(data);
    });
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Proyectos</h1>
      <p className="mt-1 text-sm text-stone-500">Lectura con API key.</p>
      {error ? (
        <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <ul className="mt-6 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {projects.map((project) => (
          <li key={project.id} className="flex items-center justify-between px-4 py-3">
            <span className="font-medium">{project.name}</span>
            <span className="text-sm text-stone-500">{project.status}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

### Create and update after sign-in

`Project.id` and `Workspace.id` are shared across apps. Pass that id on create. Do not let the API invent a new one when the record already exists elsewhere.

```ts
import { client } from '@/lib/client';

const projectId = 'shared-project-id';

await client.models.Project.create({
  id: projectId,
  name: 'Finca Norte',
  status: 'active',
  trees: [],
  topologies: [],
});

await client.models.Workspace.create({
  id: 'shared-workspace-id',
  name: 'Lote 1',
  status: 'active',
  projectId,
});

await client.models.Analysis.create({
  name: 'Compuesto de bandas',
  type: 'SATELLITE',
  is_editable: true,
  workspaceId: 'shared-workspace-id',
  start_date: '2026-10-01',
  end_date: '2026-10-20',
  geo_JSON_polygon: { type: 'Polygon', coordinates: [] },
  s3_src_output_image: 'analysis/shared-workspace-id/output.png',
});
```

`Analysis.type` is `SATELLITE` or `AI_MANAGER`. `SatelliteTopology.type` is `SATELLITE_BAND`. Dates are `YYYY-MM-DD`.

An API-key client cannot call `create`, `update`, or `delete`. Those calls return an authorization error.

### Server Component reads

Use the Next.js adapter so a Server Component can send the signed-in user's cookies. In Next.js 15, pass the `cookies` function itself. Do not await it before handing it to the client.

`src/lib/server-client.ts`:

```ts
import { generateServerClientUsingCookies } from '@aws-amplify/adapter-nextjs/data';
import { cookies } from 'next/headers';
import outputs from '@/amplify_outputs.json';
import type { Schema } from '@oraculo/schema';

export const cookieClient = generateServerClientUsingCookies<Schema>({
  config: outputs,
  cookies,
});
```

```tsx
import { cookieClient } from '@/lib/server-client';

export default async function ProjectsPage() {
  const { data: projects } = await cookieClient.models.Project.list();

  return (
    <ul className="divide-y divide-stone-200">
      {projects.map((project) => (
        <li key={project.id} className="py-2">{project.name}</li>
      ))}
    </ul>
  );
}
```

That server client uses the user pool when a session cookie exists. For a public read on the server, call `cookieClient.models.Project.list({ authMode: 'apiKey' })`.

## 4. Sign in

`src/app/sign-in/page.tsx`:

```tsx
'use client';

import { FormEvent, useState } from 'react';
import { confirmSignIn, signIn } from 'aws-amplify/auth';
import { useRouter } from 'next/navigation';

export default function SignInPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (needsTotp) {
        await confirmSignIn({ challengeResponse: totp });
        router.push('/');
        return;
      }
      const result = await signIn({ username, password });
      if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
        setNeedsTotp(true);
        return;
      }
      router.push('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo iniciar sesión');
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Entrar</h1>
        <label className="block text-sm">
          Usuario
          <input
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-sm">
          Contraseña
          <input
            className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>
        {needsTotp ? (
          <label className="block text-sm">
            Código TOTP
            <input
              className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2"
              value={totp}
              onChange={(event) => setTotp(event.target.value)}
              inputMode="numeric"
            />
          </label>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button type="submit" className="w-full rounded-md bg-stone-900 px-3 py-2 text-sm text-white">
          {needsTotp ? 'Confirmar' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
```

Sign out from a client component:

```ts
import { signOut } from 'aws-amplify/auth';

await signOut();
```

## 5. Storage

Upload and download only after sign-in, and only under `models/` or `analysis/`. Pass the bucket name from the backend output.

```ts
import { getUrl, uploadData } from 'aws-amplify/storage';

const path = `models/${file.name}`;

await uploadData({
  path,
  data: file,
  options: { bucket: 'ts-oraculo-models' },
}).result;

const { url } = await getUrl({
  path: 'analysis/shared-workspace-id/output.png',
  options: { bucket: 'ts-oraculo-models' },
});
```

Store `path` (for example `analysis/shared-workspace-id/output.png`) on `Analysis.s3_src_output_image`. The presigned URL expires, so persist the path, not the URL.

A file input styled with Tailwind:

```tsx
'use client';

import { uploadData } from 'aws-amplify/storage';

export function ModelUpload() {
  return (
    <label className="inline-flex cursor-pointer rounded-md bg-stone-900 px-3 py-2 text-sm text-white">
      Subir modelo
      <input
        className="sr-only"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void uploadData({
            path: `models/${file.name}`,
            data: file,
            options: { bucket: 'ts-oraculo-models' },
          }).result;
        }}
      />
    </label>
  );
}
```

Calls made while signed out fail. The bucket policy only allows the authenticated role on those two prefixes.

## 6. Run

In this backend repo, with an active SSO session:

```sh
npm run sandbox --profile terrasacha-amplify-admin
```

In the Next.js app:

```sh
npm run dev
```

Open `http://localhost:3000`. The public page lists projects with the API key. `/sign-in` is required before creating records or uploading files.
