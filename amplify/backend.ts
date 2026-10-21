import { defineBackend } from '@aws-amplify/backend';
import { Effect, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { auth } from './auth/resource';
import { data } from './data/resource';

const MODELS_BUCKET = 'ts-oraculo-models';
const REGION = 'us-east-1';

const backend = defineBackend({
  auth,
  data,
});

const modelsBucket = Bucket.fromBucketArn(
  backend.stack,
  'OraculoModelsBucket',
  `arn:aws:s3:::${MODELS_BUCKET}`,
);

backend.addOutput({
  storage: {
    aws_region: REGION,
    bucket_name: MODELS_BUCKET,
    buckets: [
      {
        name: MODELS_BUCKET,
        bucket_name: modelsBucket.bucketName,
        aws_region: REGION,
        paths: {
          'models/*': {
            authenticated: ['get', 'list', 'write', 'delete'],
          },
          'analysis/*': {
            authenticated: ['get', 'list', 'write', 'delete'],
          },
        },
      },
    ],
  },
});

const modelsBucketPolicy = new Policy(backend.stack, 'OraculoModelsAuthPolicy', {
  statements: [
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [
        `${modelsBucket.bucketArn}/models/*`,
        `${modelsBucket.bucketArn}/analysis/*`,
      ],
    }),
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['s3:ListBucket'],
      resources: [modelsBucket.bucketArn],
      conditions: {
        StringLike: {
          's3:prefix': ['models/', 'models/*', 'analysis/', 'analysis/*'],
        },
      },
    }),
  ],
});

backend.auth.resources.authenticatedUserIamRole.attachInlinePolicy(
  modelsBucketPolicy,
);
