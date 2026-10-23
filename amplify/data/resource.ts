import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/**
 * Oraculo data model from DB_ER_Oraculo_V10.
 *
 * Project and Workspace ids are shared across apps. Callers set `id`
 * on create to that shared value.
 *
 * Workspace lists both `project: String` and `project: Project (belongsTo)`.
 * The belongsTo is the Project relationship (`project` / `projectId`).
 *
 * Auth:
 * - Cognito user pool (default): create, read, update, delete
 * - API key: read
 * - SatelliteTopology also allows API key create, so the sandbox
 *   admin profile can seed the catalog from stack outputs
 */
const schema = a
  .schema({
    User: a.model({
      name: a.string(),
      role: a.string(),
      userWorkspace: a.hasMany('UserWorkspace', 'userOwnerId'),
    }),

    UserWorkspace: a.model({
      is_public: a.boolean(),
      userOwnerId: a.id().required(),
      userOwner: a.belongsTo('User', 'userOwnerId'),
      workspaceId: a.id().required(),
      workspace: a.belongsTo('Workspace', 'workspaceId'),
    }),

    Project: a.model({
      name: a.string(),
      status: a.string(),
      trees: a.json(),
      topologies: a.json(),
      workspaces: a.hasMany('Workspace', 'projectId'),
    }),

    Workspace: a.model({
      name: a.string(),
      status: a.string(),
      projectId: a.id(),
      project: a.belongsTo('Project', 'projectId'),
      userWorkspace: a.hasMany('UserWorkspace', 'workspaceId'),
      analyses: a.hasMany('Analysis', 'workspaceId'),
    }),

    Analysis: a.model({
      name: a.string(),
      is_editable: a.boolean(),
      type: a.string(),
      geo_JSON_polygon: a.json(),
      start_date: a.date(),
      end_date: a.date(),
      s3_src_output_image: a.string(),
      workspaceId: a.id().required(),
      workspace: a.belongsTo('Workspace', 'workspaceId'),
      satelliteTopologyAnalyses: a.hasMany(
        'SatelliteTopologyAnalysis',
        'analysisId',
      ),
    }),

    SatelliteTopology: a.model({
      type: a.string(),
      name: a.string(),
      description: a.string(),
      is_model: a.boolean(),
      satelliteTopologyParentId: a.id(),
      satelliteTopologyParent: a.belongsTo(
        'SatelliteTopology',
        'satelliteTopologyParentId',
      ),
      satelliteTopology: a.hasMany(
        'SatelliteTopology',
        'satelliteTopologyParentId',
      ),
      satelliteTopologyModelsAs: a.hasMany(
        'SatelliteTopologyModelAI',
        'satelliteTopologyId',
      ),
      satelliteTopologyAnalyses: a.hasMany(
        'SatelliteTopologyAnalysis',
        'satelliteTopologyId',
      ),
    }).authorization((allow) => [
      allow.authenticated().to(['read', 'create', 'update', 'delete']),
      allow.publicApiKey().to(['read', 'create']),
    ]),

    SatelliteTopologyModelAI: a.model({
      satelliteTopologyId: a.id().required(),
      satelliteTopology: a.belongsTo('SatelliteTopology', 'satelliteTopologyId'),
      modelAIId: a.id().required(),
      modelAI: a.belongsTo('ModelAI', 'modelAIId'),
    }),

    ModelAI: a.model({
      group: a.string(),
      name: a.string(),
      description: a.string(),
      version: a.string(),
      document_link: a.string(),
      api_latest: a.boolean(),
      api_link: a.string(),
      is_approved: a.boolean(),
      tokens_cost_txt: a.string(),
      cost_tokens: a.integer(),
      modelAIParentId: a.id(),
      modelAIParent: a.belongsTo('ModelAI', 'modelAIParentId'),
      modelAI: a.hasMany('ModelAI', 'modelAIParentId'),
      satelliteTopologyModels: a.hasMany(
        'SatelliteTopologyModelAI',
        'modelAIId',
      ),
      satelliteTopologyAnalyses: a.hasMany(
        'SatelliteTopologyAnalysis',
        'modelAIId',
      ),
    }),

    SatelliteTopologyAnalysis: a.model({
      satelliteTopologyId: a.id().required(),
      satelliteTopology: a.belongsTo('SatelliteTopology', 'satelliteTopologyId'),
      analysisId: a.id().required(),
      analysis: a.belongsTo('Analysis', 'analysisId'),
      modelAIId: a.id().required(),
      modelAI: a.belongsTo('ModelAI', 'modelAIId'),
    }),
  })
  .authorization((allow) => [
    allow.authenticated().to(['read', 'create', 'update', 'delete']),
    allow.publicApiKey().to(['read']),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  name: 'OraculoApi',
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
    apiKeyAuthorizationMode: {
      expiresInDays: 365,
    },
  },
});
