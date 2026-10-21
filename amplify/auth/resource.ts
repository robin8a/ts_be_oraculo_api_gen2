import { referenceAuth } from '@aws-amplify/backend';

/**
 * Reuses the platform production Cognito resources.
 *
 * User pool: platform4b7079bf_userpool_4b7079bf
 * User pool ID: us-east-1_D6a0Qt0RG
 * Identity pool: platform_identitypool_98275965__production
 *
 * Amplify appends this app's IAM policies to the referenced roles.
 * It does not modify the user pool.
 *
 * Web client (no secret): 4c8sqf7jr0534shtd8jpqeb52a
 * Native client: 450e17e79erhlnmc0i9ievedvl
 */
export const auth = referenceAuth({
  userPoolId: 'us-east-1_D6a0Qt0RG',
  userPoolClientId: '4c8sqf7jr0534shtd8jpqeb52a',
  identityPoolId: 'us-east-1:82ed26ed-5589-4f8e-89b5-6433c7a9cce0',
  authRoleArn:
    'arn:aws:iam::879381245127:role/amplify-platform-production-a9f84-authRole',
  unauthRoleArn:
    'arn:aws:iam::879381245127:role/amplify-platform-production-a9f84-unauthRole',
});
