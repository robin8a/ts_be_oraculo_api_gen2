# TerraSacha Backend Oraculo API amplify Gen2

```sh
response=$(aws sso-admin list-instances)
ssoId=$(echo $response | jq '.Instances[0].IdentityStoreId' -r)
ssoArn=$(echo $response | jq '.Instances[0].InstanceArn' -r)
email_json=$(jq -n --arg email "$user_email" '{"Type":"Work","Value":$email}')
response=$(aws identitystore create-user --identity-store-id $ssoId --user-name terrasacha-amplify-admin --display-name 'Terra Sacha Amplify Admin' --name Formatted=string,FamilyName=Admin,GivenName=Amplify --emails "$email_json")
userId=$(echo $response | jq '.UserId' -r)
response=$(aws sso-admin create-permission-set --name amplify-policy --instance-arn=$ssoArn --session-duration PT12H)
permissionSetArn=$(echo $response | jq '.PermissionSet.PermissionSetArn' -r)
aws sso-admin attach-managed-policy-to-permission-set --instance-arn $ssoArn --permission-set-arn $permissionSetArn --managed-policy-arn arn:aws:iam::aws:policy/service-role/AmplifyBackendDeployFullAccess
accountId=$(aws sts get-caller-identity | jq '.Account' -r)
aws sso-admin create-account-assignment --instance-arn $ssoArn --target-id $accountId --target-type AWS_ACCOUNT --permission-set-arn $permissionSetArn --principal-type USER --principal-id $userId

printf "\n\nStart session url: https://$ssoId.awsapps.com/start\nRegion: $AWS_REGION\nUsername: terrasacha-amplify-admin\n\n"

```

```sh
aws configure sso
aws sts get-caller-identity --profile terrasacha-amplify-admin
aws sso login --profile terrasacha-amplify-admin
```

## Help to create a Amplify gen2 backend with: 

- Use the aws sso profile "--profile terrasacha-amplify-admin" for example: "aws sts get-caller-identity --profile terrasacha-amplify-admin"
- Configure the auth with User pool ID: us-east-1_D6a0Qt0RG
- Configure the Storage with: ts-oraculo-models
- Data from the Database desing @_000_INCEPTION/DB_ER_Oraculo_V10.drawio.png also allow another auth mode with apiKey


```sh

npm run sandbox --profile terrasacha-amplify-admin
```