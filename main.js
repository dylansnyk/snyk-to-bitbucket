import axios from 'axios'
import minimist from 'minimist'
import { v4 as uuidv4 } from 'uuid'

const BB_API_URL = 'https://api.bitbucket.org/2.0/repositories'

const argv = minimist(process.argv.slice(2));

const BB_USER = argv['user']
const BB_APP_PASSWORD = argv['password']
const REPO = argv['repo']
const COMMIT = argv['commit']

const mapSnykToBitBucket = async (snykRawOutput) => {

  const snykResult = JSON.parse(snykRawOutput);

  // 1. Delete Existing Report
  await axios.delete(`${BB_API_URL}/${BB_USER}/${REPO}/commit/${COMMIT}/reports/snyk-open-source`,
    {
      auth: {
        username: BB_USER,
        password: BB_APP_PASSWORD
      }
    }
  )

  // 2. Create Report 
  await axios.put(
    `${BB_API_URL}/${BB_USER}/${REPO}/commit/${COMMIT}/reports/snyk-open-source`,
    {
      title: "Snyk Open Source",
      details: `This repository contains ${snykResult['uniqueCount']} open source vulnerabilities`,
      report_type: "SECURITY",
      reporter: "Snyk",
      result: "PASSED"
    },
    {
      auth: {
        username: BB_USER,
        password: BB_APP_PASSWORD
      }
    }
  )

  // 3. Upload Annotations (Vulnerabilities)
  const set = new Set()

  const vulns = snykResult['vulnerabilities']
    .filter(vuln => {
      if (set.has(vuln['id'])) {
        return false
      }
      set.add(vuln['id'])
      return true
    })
    .map(vuln => {
      return {
        external_id: uuidv4(),
        annotation_type: "VULNERABILITY",
        title: vuln['title'],
        severity: vuln['severity'].toUpperCase(),
        summary: `${vuln['packageName']}@${vuln['version']}`,
        path: snykResult['displayTargetFile']
      }
    })

  await axios.post(`${BB_API_URL}/${BB_USER}/${REPO}/commit/${COMMIT}/reports/snyk-open-source/annotations`,
    vulns,
    {
      auth: {
        username: BB_USER,
        password: BB_APP_PASSWORD
      }
    }
  )
}

const getInput = () => {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    let data = '';

    stdin.setEncoding('utf8');
    stdin.on('data', function (chunk) {
      data += chunk;
    });

    stdin.on('end', function () {
      resolve(data);
    });

    stdin.on('error', reject);
  });
}

getInput().then(mapSnykToBitBucket).catch(console.error)