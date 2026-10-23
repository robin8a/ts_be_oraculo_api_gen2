# Seed

Seed assets and scripts that load data into the Amplify Gen2 AppSync API.

## Seed `SatelliteTopology`

- **Script**: `_001_SEED/seedSatelliteTopology.js`
- **Input file**: `_001_SEED/satellite_seed.json`
- **Target model**: `SatelliteTopology`

### What it creates

The script loads a parent to child hierarchy:

- **Parent nodes**: satellites
- **Child nodes**: bands, one node per band, attached to its satellite

### Field mapping

For each satellite:

- **id**: satellite key (for example `LC08`)
- **type**: `SATELITE`
- **name**: `satellite.name` (for example `LANDSAT_8`)
- **description**: `satellite.display_name` (for example `Landsat 8`)

For each band:

- **id**: `${satelliteId}#${bandId}` (for example `LC08#B4`)
- **type**: `BANDS`
- **name**: `band.id` (for example `B4`)
- **description**: `band.tooltip_title` (for example `B4 - Red`)
- **parent**: `satelliteTopologyParentId` set to the satellite id

### Idempotency

The script checks `getSatelliteTopology(id)` before creating. Existing nodes are skipped.

### How it authenticates

Profile `terrasacha-amplify-admin` reads the live sandbox stack outputs (`awsAppsyncApiEndpoint` and `awsAppsyncApiKey`). GraphQL calls use that API key.

`SatelliteTopology` allows API key create. Other models stay read-only for the API key. Redeploy the sandbox after pulling this change so the rule is live:

```bash
npm run sandbox:once
```

### Run

```bash
aws sso login --profile terrasacha-amplify-admin
npm run seed:satellite-topology:dry
npm run seed:satellite-topology
```

Or directly:

```bash
node _001_SEED/seedSatelliteTopology.js --dry-run
node _001_SEED/seedSatelliteTopology.js
```

### Options

- **`--profile <name>`**: AWS profile used to read the sandbox stack. Default: `terrasacha-amplify-admin`
- **`--region <region>`**: Default: `us-east-1`
- **`--stack <name>`**: sandbox stack name. Default: the single `amplify-tsbeoraculoapigen2-oraculo-sandbox-*` root stack
- **`--outputs <path>`**: read `amplify_outputs.json` instead of CloudFormation
- **`--seed <path>`**: seed file. Default: `./satellite_seed.json`
- **`--dry-run`**: count creates without writing
- **`--help` / `-h`**: show usage
