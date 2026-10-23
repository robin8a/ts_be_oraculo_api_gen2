#!/usr/bin/env node
/* eslint-disable no-console */

import { execFile } from "child_process";
import fs from "fs";
import https from "https";
import path from "path";
import { promisify } from "util";
import { fileURLToPath } from "url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_PROFILE = "terrasacha-amplify-admin";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_SEED_PATH = path.resolve(__dirname, "./satellite_seed.json");
const DEFAULT_OUTPUTS_PATH = path.resolve(__dirname, "../amplify_outputs.json");
const ROOT_STACK_PATTERN = /^amplify-tsbeoraculoapigen2-oraculo-sandbox-[0-9a-f]+$/;

const DROPPED_AWS_ENV = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_SECURITY_TOKEN",
  "AWS_PROFILE",
  "AWS_DEFAULT_PROFILE",
];

const GET_SATELLITE_TOPOLOGY_QUERY = /* GraphQL */ `
  query GetSatelliteTopology($id: ID!) {
    getSatelliteTopology(id: $id) {
      id
    }
  }
`;

const CREATE_SATELLITE_TOPOLOGY_MUTATION = /* GraphQL */ `
  mutation CreateSatelliteTopology($input: CreateSatelliteTopologyInput!) {
    createSatelliteTopology(input: $input) {
      id
      type
      name
      description
      satelliteTopologyParentId
    }
  }
`;

function parseArgs(argv) {
  const args = {
    dryRun: false,
    seedPath: DEFAULT_SEED_PATH,
    outputsPath: DEFAULT_OUTPUTS_PATH,
    profile: DEFAULT_PROFILE,
    region: DEFAULT_REGION,
    stackName: "",
    useOutputsFile: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--seed" && next) {
      args.seedPath = path.resolve(next);
      i += 1;
    } else if (arg === "--outputs" && next) {
      args.outputsPath = path.resolve(next);
      args.useOutputsFile = true;
      i += 1;
    } else if (arg === "--profile" && next) {
      args.profile = next;
      i += 1;
    } else if (arg === "--region" && next) {
      args.region = next;
      i += 1;
    } else if (arg === "--stack" && next) {
      args.stackName = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") args.help = true;
  }

  return args;
}

function awsEnv(region) {
  const env = { ...process.env, AWS_REGION: region, AWS_EC2_METADATA_DISABLED: "true" };
  delete env.AWS_DEFAULT_REGION;
  for (const key of DROPPED_AWS_ENV) delete env[key];
  return env;
}

async function awsJson(profile, region, args) {
  const { stdout } = await execFileAsync(
    "aws",
    [...args, "--profile", profile, "--region", region, "--output", "json"],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, env: awsEnv(region) }
  );
  return JSON.parse(stdout);
}

async function findSandboxStack(profile, region, explicitName) {
  if (explicitName) return explicitName;

  const listed = await awsJson(profile, region, [
    "cloudformation",
    "list-stacks",
    "--stack-status-filter",
    "CREATE_COMPLETE",
    "UPDATE_COMPLETE",
    "UPDATE_ROLLBACK_COMPLETE",
  ]);
  const names = (listed.StackSummaries || []).map((stack) => stack.StackName);
  const matches = names.filter((name) => ROOT_STACK_PATTERN.test(name));
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new Error(
      `No Amplify Gen2 sandbox stack found for profile ${profile}. Deploy with "npm run sandbox", or pass --stack.`
    );
  }
  throw new Error(`Multiple sandbox stacks found: ${matches.join(", ")}. Pass --stack.`);
}

async function loadClientFromStack(profile, region, stackName) {
  const described = await awsJson(profile, region, [
    "cloudformation",
    "describe-stacks",
    "--stack-name",
    stackName,
  ]);
  const stack = described.Stacks && described.Stacks[0];
  const outputs = Object.fromEntries((stack?.Outputs || []).map((output) => [output.OutputKey, output.OutputValue]));
  const endpoint = outputs.awsAppsyncApiEndpoint;
  const apiKey = outputs.awsAppsyncApiKey;
  const apiRegion = outputs.awsAppsyncRegion || region;

  if (!endpoint || !apiKey) {
    throw new Error(
      `Stack ${stackName} is missing awsAppsyncApiEndpoint or awsAppsyncApiKey. Redeploy the sandbox and try again.`
    );
  }

  return { endpoint, apiKey, region: apiRegion, source: `stack ${stackName}` };
}

function loadClientFromOutputs(outputsPath) {
  const cfg = JSON.parse(fs.readFileSync(outputsPath, "utf8"));
  const data = cfg.data || {};
  const endpoint = data.url || cfg.aws_appsync_graphqlEndpoint;
  const apiKey = data.api_key || cfg.aws_appsync_apiKey;
  const region = data.aws_region || cfg.aws_appsync_region || DEFAULT_REGION;

  if (!endpoint || !apiKey) {
    throw new Error(`Missing data.url or data.api_key in ${outputsPath}.`);
  }

  return { endpoint, apiKey, region, source: outputsPath };
}

async function loadClient(args) {
  if (args.useOutputsFile) return loadClientFromOutputs(args.outputsPath);

  try {
    const stackName = await findSandboxStack(args.profile, args.region, args.stackName);
    return await loadClientFromStack(args.profile, args.region, stackName);
  } catch (error) {
    if (args.stackName || !fs.existsSync(args.outputsPath)) throw error;
    console.warn(`Could not read the sandbox stack with profile ${args.profile}: ${error.message}`);
    console.warn(`Falling back to ${args.outputsPath}`);
    return loadClientFromOutputs(args.outputsPath);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function graphqlRequestOnce({ endpoint, apiKey }, query, variables) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const postData = JSON.stringify({ query, variables });
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(postData),
          "x-api-key": apiKey,
        },
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`GraphQL request failed: status=${res.statusCode} body=${data.slice(0, 500)}`));
              return;
            }
            const parsed = JSON.parse(data);
            if (parsed.errors && parsed.errors.length) {
              const wrote = parsed.data && (parsed.data.createSatelliteTopology || parsed.data.getSatelliteTopology);
              const alreadyExists = parsed.errors.every((err) =>
                String(err.errorType || "").includes("ConditionalCheckFailed")
              );
              if (wrote || alreadyExists) {
                resolve(parsed.data || {});
                return;
              }
              const unauthorized = parsed.errors.some((err) => err.errorType === "Unauthorized");
              if (unauthorized) {
                reject(
                  new Error(
                    `AppSync rejected the write. Redeploy the sandbox so SatelliteTopology allows API key create. ${JSON.stringify(parsed.errors)}`
                  )
                );
                return;
              }
              reject(new Error(`GraphQL errors: ${JSON.stringify(parsed.errors)}`));
              return;
            }
            resolve(parsed.data);
          } catch (error) {
            reject(new Error(`Failed parsing GraphQL response: ${error.message}. Body=${data.slice(0, 500)}`));
          }
        });
      }
    );

    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("GraphQL request timeout"));
    });
    req.write(postData);
    req.end();
  });
}

async function graphqlRequest(client, query, variables) {
  const attempts = 4;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await graphqlRequestOnce(client, query, variables);
    } catch (error) {
      const retryable = /rejected the write|status=5|timeout|ECONNRESET|ETIMEDOUT/.test(error.message);
      if (!retryable || attempt === attempts) throw error;
      await delay(400 * attempt);
    }
  }
  throw new Error("GraphQL request failed");
}

async function existsSatelliteTopology(client, id) {
  const data = await graphqlRequest(client, GET_SATELLITE_TOPOLOGY_QUERY, { id });
  return Boolean(data && data.getSatelliteTopology);
}

async function createSatelliteTopology(client, input) {
  const data = await graphqlRequest(client, CREATE_SATELLITE_TOPOLOGY_MUTATION, { input });
  return data.createSatelliteTopology;
}

function loadSeed(seedPath) {
  const parsed = JSON.parse(fs.readFileSync(seedPath, "utf8"));
  if (!parsed || parsed.success !== true || !parsed.satellites) {
    throw new Error(`Unexpected seed format in ${seedPath}. Expected { success: true, satellites: {...} }`);
  }
  return parsed;
}

function buildNodes(seed) {
  const satellites = [];
  const bands = [];

  for (const [satelliteId, sat] of Object.entries(seed.satellites)) {
    satellites.push({
      id: satelliteId,
      type: "SATELITE",
      name: sat.name,
      description: sat.display_name,
    });

    const satBands = Array.isArray(sat.bands) ? sat.bands : [];
    for (const band of satBands) {
      bands.push({
        id: `${satelliteId}#${band.id}`,
        type: "BANDS",
        name: band.id,
        description: band.tooltip_title,
        parentId: satelliteId,
      });
    }
  }

  return { satellites, bands };
}

function printHelp() {
  console.log(
    `
Seed SatelliteTopology from satellite_seed.json into the Amplify Gen2 AppSync API.

The profile reads the live sandbox stack (endpoint and API key). It does not
call AppSync with IAM. AmplifyBackendDeployFullAccess can read stack outputs
and the API key can create SatelliteTopology records.

Usage:
  node _001_SEED/seedSatelliteTopology.js [--dry-run] [--profile <name>] [--region <region>] [--stack <name>] [--seed <path>] [--outputs <path>]

Defaults:
  --profile ${DEFAULT_PROFILE}
  --region ${DEFAULT_REGION}
`.trim()
  );
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const client = await loadClient(args);
  const seed = loadSeed(args.seedPath);
  const { satellites, bands } = buildNodes(seed);

  console.log(`Loaded seed: satellites=${satellites.length} bands=${bands.length}`);
  console.log(`Profile: ${args.profile}`);
  console.log(`Target AppSync: ${client.endpoint} (${client.source})`);
  if (args.dryRun) console.log("Dry-run enabled: no writes will be performed.");

  let created = 0;
  let skipped = 0;
  let createdSatellites = 0;
  let skippedSatellites = 0;
  let createdBands = 0;
  let skippedBands = 0;

  async function upsert(node, kind) {
    const present = await existsSatelliteTopology(client, node.id);
    if (present) {
      skipped += 1;
      if (kind === "satellite") skippedSatellites += 1;
      else skippedBands += 1;
      return;
    }

    if (args.dryRun) {
      created += 1;
      if (kind === "satellite") createdSatellites += 1;
      else createdBands += 1;
      return;
    }

    const input = {
      id: node.id,
      type: node.type,
      name: node.name,
      description: node.description,
    };
    if (node.parentId) input.satelliteTopologyParentId = node.parentId;

    await createSatelliteTopology(client, input);
    created += 1;
    if (kind === "satellite") createdSatellites += 1;
    else createdBands += 1;
  }

  for (let i = 0; i < satellites.length; i += 1) {
    if (i % 5 === 0) console.log(`Seeding satellites ${i}/${satellites.length}...`);
    await upsert(satellites[i], "satellite");
  }

  for (let i = 0; i < bands.length; i += 1) {
    if (i % 25 === 0) console.log(`Seeding bands ${i}/${bands.length}...`);
    await upsert(bands[i], "band");
  }

  console.log(
    `Done. created=${created} skipped=${skipped} (satellites: +${createdSatellites}/~${skippedSatellites}, bands: +${createdBands}/~${skippedBands})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
