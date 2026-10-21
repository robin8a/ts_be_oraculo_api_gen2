# TerraSacha Backend Oraculo API (Amplify Gen 2)

AppSync and DynamoDB API for Oraculo. The schema follows `_000_INCEPTION/DB_ER_Oraculo_V10.drawio.png`. Auth reuses the platform production Cognito user pool. File storage uses the existing bucket `ts-oraculo-models`.

## Prerequisites

AWS CLI v2, Node.js, and an SSO session for profile `terrasacha-amplify-admin`.

```sh
aws configure sso
aws sso login --profile terrasacha-amplify-admin
aws sts get-caller-identity --profile terrasacha-amplify-admin
```

Start URL: `https://d-9067d53b03.awsapps.com/start`  
Account: `879381245127`  
Region: `us-east-1`

## Scripts

```sh
npm install
npm run sandbox --profile terrasacha-amplify-admin
npm run sandbox:once --profile terrasacha-amplify-admin
npm run sandbox:delete --profile terrasacha-amplify-admin
npm run typecheck
```

`sandbox` deploys identifier `oraculo` and keeps watching `amplify/`. `sandbox:once` deploys a single time. Both commands use profile `terrasacha-amplify-admin`.

A successful deploy writes `amplify_outputs.json` in the repo root. That file is gitignored and contains the API key.

## Current sandbox

| | |
|---|---|
| Identifier | `oraculo` |
| Stack | `amplify-tsbeoraculoapigen2-oraculo-sandbox-75beb1a639` |
| GraphQL | `https://lfl7wnxzvjdnzfhdm5ymn4xjum.appsync-api.us-east-1.amazonaws.com/graphql` |
| Region | `us-east-1` |
| Default auth | Cognito user pool |

The endpoint can change if the sandbox is deleted and created again. Read the live values from `amplify_outputs.json`.

## Auth

Defined in `amplify/auth/resource.ts` with `referenceAuth`. Amplify does not create or modify the user pool. On deploy it appends this app's IAM policies to the referenced roles.

| Resource | Value |
|---|---|
| User pool | `platform4b7079bf_userpool_4b7079bf` |
| User pool ID | `us-east-1_D6a0Qt0RG` |
| Web client | `4c8sqf7jr0534shtd8jpqeb52a` |
| Identity pool | `us-east-1:82ed26ed-5589-4f8e-89b5-6433c7a9cce0` |
| Auth role | `amplify-platform-production-a9f84-authRole` |
| Unauth role | `amplify-platform-production-a9f84-unauthRole` |

## Data

API name: `OraculoApi` (`amplify/data/resource.ts`).

| Mode | Client `authMode` | Operations |
|---|---|---|
| Cognito user pool (default) | `userPool` | create, read, update, delete |
| API key | `apiKey` | read |
| IAM | `iam` | enabled for the Amplify console |

The API key expires 365 days after each deploy. Redeploy to extend it.

`Project.id` and `Workspace.id` are shared across apps. Set `id` on create to that shared value.

The diagram lists both `project: String` and `project: Project` on Workspace. The API keeps the relationship: `projectId` and `project`.

| Model | Relationships |
|---|---|
| User | `userWorkspace` → UserWorkspace |
| UserWorkspace | `userOwner` → User, `workspace` → Workspace |
| Project | `workspaces` → Workspace. Also `trees` and `topologies` (JSON) |
| Workspace | `project` → Project, `userWorkspace`, `analyses` |
| Analysis | `workspace` → Workspace, `satelliteTopologyAnalyses`. `type`: `SATELLITE`, `AI_MANAGER` |
| SatelliteTopology | self parent/children, `satelliteTopologyModelsAs`, `satelliteTopologyAnalyses`. `type`: `SATELLITE_BAND` |
| SatelliteTopologyModelAI | `satelliteTopology` + `modelAI` |
| ModelAI | self parent/children, `satelliteTopologyModels`, `satelliteTopologyAnalyses` |
| SatelliteTopologyAnalysis | `satelliteTopology` + `analysis` + `modelAI` |

## Storage

The backend imports bucket `ts-oraculo-models` in `us-east-1`. It does not create a new bucket. Signed-in users can get, list, write, and delete:

- `models/*`
- `analysis/*`

Pass the bucket name `ts-oraculo-models` to the Amplify Storage APIs. Analysis image paths are stored on `Analysis.s3_src_output_image`.

## Layout

```
amplify/auth/resource.ts    existing Cognito user pool
amplify/data/resource.ts    OraculoApi schema
amplify/backend.ts          data, auth, and the models bucket
scripts/ampx-with-sso.mjs   runs ampx with terrasacha-amplify-admin
_000_INCEPTION/             ER diagram and setup notes
```
