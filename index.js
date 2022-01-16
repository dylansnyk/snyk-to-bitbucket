#!/usr/bin/env node

import axios from 'axios'
import minimist from 'minimist'
import { v4 as uuidv4 } from 'uuid'

const BB_API_URL = 'https://api.bitbucket.org/2.0/repositories'

const argv = minimist(process.argv.slice(2));

const BB_USER = argv['user']
const BB_APP_PASSWORD = argv['password']
const REPO = argv['repo']
const COMMIT = argv['commit']

const paramsAreValid = () => {
  if (BB_USER == null) {
    console.log('Error: specify user')
    return false
  }

  if (BB_APP_PASSWORD == null) {
    console.log('Error: specify password')
    return false
  }

  if (REPO == null) {
    console.log('Error: specify repo')
    return false
  }

  if (COMMIT == null) {
    console.log('Error: specify commit')
    return false
  }

  return true
}

const mapCode = (snykResult) => {
  const severityMap = {
    'note': 'LOW',
    'warning': 'MEDIUM',
    'error': 'HIGH'
  }

  return snykResult['runs'][0]['results']
    .map(result => {
      return {
        external_id: uuidv4(),
        annotation_type: "VULNERABILITY",
        severity: severityMap[result['level']],
        path: result['locations'][0]['physicalLocation']['artifactLocation']['uri'],
        line: result['locations'][0]['physicalLocation']['region']['endLine'],
        title: result['ruleId'],
        summary: result['message']['text']
      }
    })
}

const mapOpenSource = (snykResult) => {
  const set = new Set()

  return snykResult['vulnerabilities']
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
        severity: vuln['severity'].toUpperCase(),
        summary: `${vuln['packageName']}@${vuln['version']}: ${vuln['title']}`,
        path: snykResult['displayTargetFile'],
        details: `Snyk vulnerability ID: ${vuln['id']}`
      }
    })
}

const getScanType = (snykResult) => {
  if (snykResult['runs'] != null) {
    return {
      id: 'snyk-code',
      title: 'Snyk Code',
      name: 'code',
      mapper: mapCode,
      count: snykResult['runs'][0]['results'].length
    }
  }

  if (snykResult['vulnerabilities'] != null) {
    return {
      id: 'snyk-open-source',
      title: 'Snyk Open Source',
      name: 'open source',
      mapper: mapOpenSource,
      count: snykResult['uniqueCount']
    }
  }

  return null
}

const mapSnykToBitBucket = async (snykRawOutput) => {

  const snykResult = JSON.parse(snykRawOutput);
  const scanType = getScanType(snykResult);

  if (scanType == null) {
    console.log('Error: json format not recognized')
    return 0;
  }

  // 1. Delete Existing Report
  await axios.delete(`${BB_API_URL}/${BB_USER}/${REPO}/commit/${COMMIT}/reports/${scanType['id']}`,
    {
      auth: {
        username: BB_USER,
        password: BB_APP_PASSWORD
      }
    }
  )

  // 2. Create Report 
  await axios.put(
    `${BB_API_URL}/${BB_USER}/${REPO}/commit/${COMMIT}/reports/${scanType['id']}`,
    {
      title: scanType['title'],
      details: `This repository contains ${scanType['count']} ${scanType['name']} vulnerabilities`,
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
  const vulns = scanType.mapper(snykResult)

  await axios.post(`${BB_API_URL}/${BB_USER}/${REPO}/commit/${COMMIT}/reports/${scanType['id']}/annotations`,
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

if (paramsAreValid()) {
  getInput().then(mapSnykToBitBucket).catch(console.error)
}