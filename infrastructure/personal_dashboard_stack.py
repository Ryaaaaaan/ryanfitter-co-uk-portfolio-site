"""Foundation resources in the existing AWS account; no standalone Cognito pool."""
from aws_cdk import (
    CfnOutput,
    CfnParameter,
    RemovalPolicy,
    Stack,
    Tags,
    aws_cognito as cognito,
    aws_dynamodb as dynamodb,
    aws_s3 as s3,
)
from constructs import Construct


class PersonalDashboardStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs):
        super().__init__(scope, construct_id, **kwargs)

        Tags.of(self).add("Project", "RyanFitterPortfolio")
        Tags.of(self).add("Environment", "personal")

        # This must be the EXISTING user pool already in use by TradingLab.
        # Create a dedicated OAuth app client, not a new pool or user identity.
        pool_id = CfnParameter(
            self,
            "ExistingCognitoUserPoolId",
            type="String",
            description="User pool ID already configured for TradingLab in eu-west-2.",
        )
        client = cognito.CfnUserPoolClient(
            self,
            "RyanFitterDashboardClient",
            user_pool_id=pool_id.value_as_string,
            client_name="RyanFitterPersonalDashboard",
            generate_secret=False,
            prevent_user_existence_errors="ENABLED",
            allowed_o_auth_flows_user_pool_client=True,
            allowed_o_auth_flows=["code"],
            allowed_o_auth_scopes=["openid", "email", "profile"],
            callback_ur_ls=["https://ryanfitter.co.uk/admin/auth/callback"],
            logout_ur_ls=["https://ryanfitter.co.uk/"],
            supported_identity_providers=["COGNITO"],
            enable_token_revocation=True,
        )

        # Future CMS, tasks and job-tracking storage. No write API is enabled
        # in the foundation and no permissions are granted to TradingLab roles.
        table = dynamodb.Table(
            self,
            "PersonalWorkspaceItems",
            partition_key=dynamodb.Attribute(
                name="pk", type=dynamodb.AttributeType.STRING
            ),
            sort_key=dynamodb.Attribute(
                name="sk", type=dynamodb.AttributeType.STRING
            ),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery=True,
            removal_policy=RemovalPolicy.RETAIN,
        )
        media = s3.Bucket(
            self,
            "PersonalPortfolioMedia",
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            encryption=s3.BucketEncryption.S3_MANAGED,
            enforce_ssl=True,
            removal_policy=RemovalPolicy.RETAIN,
        )

        CfnOutput(self, "CognitoAppClientId", value=client.ref)
        CfnOutput(self, "CognitoUserPoolId", value=pool_id.value_as_string)
        CfnOutput(self, "WorkspaceTableName", value=table.table_name)
        CfnOutput(self, "PortfolioMediaBucketName", value=media.bucket_name)
