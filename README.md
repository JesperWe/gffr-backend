# Corporate Fiber PropView Backend

This repo is the main backend for Corporate Fiber PropView. It has two main parts:

- The main GraphQL endpoint, which uses [PostGraphile](https://www.graphile.org/) 
to automatically build the GraphQL schema from the Postgres database structure.

- A set of integration miro services exposed through REST:

 - IAM endpoints using the FusionAuth system
 
 - LIME CRM Integration endpoints
 
## Infrastructure

<img src="./infrastructure.png" height="700px"/>

(Original: https://drive.google.com/a/apegroup.com/file/d/1mck5HL8l7SOsOxJRKWJ5GTfwaNYnmpUK/view)

## IAM through FusionAuth

The system leverages FusionAuth for identity and access management. 
The users identity and access role is stored in a JWT token which is used both by the GraphQL 
service and other REST microservices to authenticate requests. 

## Strapi CMS

An instance of the Strapi CMS is used to provide editor UI for some of the tables in the database. 
This is done to save admin UI development effort for data that only a few in-house editors will touch.

## Schema

In the initial phase of development the DB schema evolved rapidly without the use of formal migrations.
The resulting initial schema is captured in [cfportal_schema_before_migrations.sql`](schema/cfportal_schema.sql)

From this base point the schema is evolved using formal migrations.

### Permission control: RBAC using RLS

Postgraphile propagates a [clients IAM role from the requests JWT](https://www.graphile.org/postgraphile/security/) to a corresponding
database user role. We then use Postgres built in access controls 
(Table/Function grants and [RLS, Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)) to control read/write access to data.

The RLS policies use a role based access table (`public.rbac`)  to calculate permissions for 
each table row in each request .

### Migrations

See the [postgres-migrations](https://github.com/thomwright/postgres-migrations) package for details.

Name all files with ids using consecutive numbers followed by underscore.
Migrations will be performed in the order of the ids.
 If ids are not consecutive or if multiple migrations have the same id, the migration run will fail.

Note the migration file names *cannot* be changed later.

Each migration can be written in SQL or JavaScript.

### Data history

We use the model from [Temporal Tables](https://github.com/arkhipov/temporal_tables) to keep a data history trail. 
However, since Microsoft Azure does not permit this extension, we use a [reimplementation in SQL](https://github.com/nearform/temporal_tables).

## Configuration

The following environment variables are available:

| Variable | Use |
| --- | --- |
| AZURE_ACCOUNT  | The account to use for Storage Blob uploads  |
| AZURE_ACCOUNT_KEY  | Key to above account  |
| CHECKBIZ_TOKEN  | API Token for CheckBiz  |
| CMS_ENDPOINT  | Strapi CMS URL "https://cms.corporatefiber.com"  |
| ENABLE_GRAPHIQL  | Set to enable the interactive GraphQL Explorer  |
| ENABLE_GRAPHILE_DEBUG  | Set to enable full debug information in GraphQL query responses  |
| ENABLE_POSTGRES_MIGRATIONS  | Set to enable DB migrations at server start  |
| FORTNOX_ACCESS_TOKEN_CF  | API key for Fortnox Corporate Fiber Account  |
| FORTNOX_ACCESS_TOKEN_FFC  | API key for Fortnox FFC Account  |
| FORTNOX_ACCESS_TOKEN_SANDBOX  | API key for Fortnox Apegroup test Account  |
| FORTNOX_CLIENT_SECRET  | That  |
| IAM_API_KEY  | API key for FusionAuth  |
| IAM_CLIENT_ID  | ID of the Corporate Fiber client in FusionAuth  |
| IAM_REDIRECT_TO  | Where the OIDC token request should redirect to  |
| IAM_TENANT_ID  | ID of the Corporate Fiber tenant in FusionAuth  |
| IAM_URL  | Fusionauth URL "https://iam.corporatefiber.com"  |
| JWKS_URL  | URL to get JWKS keys "https://iam.corporatefiber.com/.well-known/jwks.json"  |
| LIME_API_KEY  | API Key for Lime CRM  |
| LIME_API_URL  | API Endpoint for Lime CRM  |
| POSTGRES_CONNECTION_URL  | Full connection URL for Postgres DB  |
| SMTP_HOST  | Host to use for sendmail  |
| SMTP_USER  | TLS login user  |
| SMTP_PASSWORD  | TLS login password  |
| JIRA_API_URL  | The Jira API url for creating Jira tickets  |
| JIRA_USER  | The Jira user, used to create the Jira tickets  |
| JIRA_API_TOKEN  | The API Token taken from the Jira application  |
