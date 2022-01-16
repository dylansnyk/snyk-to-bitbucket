# Snyk to BitBucket

A script to create Snyk Open Source and Snyk Code reports on BitBucket pull requests

This will not cause the pull request to fail, but rather will bring visibility to existing vulnerabilities in the code base

## Getting Started 

Install:

`npm i -g snyk-to-bb`

BitBucket Configuration:

Create Repository Variables `BB_USER` and `BB_APP_PASSWORD` corresponding to a username / app password with BitBucket API access

Create Snyk Open Source Report:

`snyk test --json | npx snyk-to-bb --user $BB_USER --password $BB_APP_PASSWORD --repo $BITBUCKET_REPO_SLUG --commit $BITBUCKET_COMMIT`

Create Snyk Code Report:

`snyk code test --json | npx snyk-to-bb --user $BB_USER --password $BB_APP_PASSWORD --repo $BITBUCKET_REPO_SLUG --commit $BITBUCKET_COMMIT`

## Example BitBucket Pipeline

```
image: atlassian/default-image:3

pipelines:
  pull-requests:
    '**': # any source branch 
      - step:
          name: Run Snyk 
          script:
            - npm i -g snyk-to-bb
            - npm i -g snyk
            - snyk test --json | npx snyk-to-bb --user $BB_USER --password $BB_APP_PASSWORD --repo $BITBUCKET_REPO_SLUG --commit $BITBUCKET_COMMIT
            - snyk code test --json | npx snyk-to-bb --user $BB_USER --password $BB_APP_PASSWORD --repo $BITBUCKET_REPO_SLUG --commit $BITBUCKET_COMMIT
