const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');
const { readFromS3, writeToS3 } = require('./s3-storage');
const { verifyToken } = require('./verifyToken');
const { fetchPersonMetrics } = require('./person-metrics');

const app = express();
app.use(bodyParser.json());

// Enable CORS
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

const lambdaClient = new LambdaClient({ region: process.env.REGION || 'us-east-1' });
const ssmClient = new SSMClient({ region: process.env.REGION || 'us-east-1' });

const JIRA_HOST = process.env.JIRA_HOST || 'https://issues.redhat.com';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// ─── Jira token cache ───

let cachedJiraToken = null;
let tokenExpiry = 0;

async function getJiraToken() {
  if (cachedJiraToken && Date.now() < tokenExpiry) {
    return cachedJiraToken;
  }

  const paramName = process.env.JIRA_TOKEN_PARAMETER_NAME
    || `/team-tracker-app/${process.env.ENV || 'dev'}/jira-token`;

  const command = new GetParameterCommand({
    Name: paramName,
    WithDecryption: true
  });
  const response = await ssmClient.send(command);
  cachedJiraToken = response.Parameter.Value;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // cache for 55 minutes
  return cachedJiraToken;
}

async function jiraRequest(path) {
  const token = await getJiraToken();
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(`${JIRA_HOST}${path}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (response.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = parseInt(response.headers.get('retry-after'), 10);
      const delay = (!isNaN(retryAfter) && retryAfter > 0) ? retryAfter * 1000 : Math.pow(2, attempt + 1) * 1000;
      console.warn(`[Jira API] Rate limited (429), retrying in ${delay / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Jira API error (${response.status}): ${text}`);
    }

    return response.json();
  }
}

function sanitizeFilename(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// ─── Allowlist seed ───

async function seedAllowlist() {
  const existing = await readFromS3('allowlist.json');
  if (existing && existing.emails && existing.emails.length > 0) {
    return;
  }

  const adminEmails = process.env.ADMIN_EMAILS;
  if (!adminEmails) {
    await writeToS3('allowlist.json', { emails: [] });
    return;
  }

  const emails = adminEmails
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  await writeToS3('allowlist.json', { emails });
}

let allowlistSeeded = false;

// ─── Auth middleware ───

app.use(async function (req, res, next) {
  if (req.method === 'OPTIONS') return next();

  // Seed allowlist on first request
  if (!allowlistSeeded) {
    await seedAllowlist();
    allowlistSeeded = true;
  }

  // Verify Firebase token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split('Bearer ')[1];
  const result = await verifyToken(token);

  if (!result.valid) {
    return res.status(401).json({ error: result.error || 'Invalid or expired token' });
  }

  req.userEmail = result.email;

  // Check allowlist
  const allowlist = await readFromS3('allowlist.json');
  if (!allowlist || !allowlist.emails.includes(req.userEmail)) {
    return res.status(403).json({ error: 'Access denied. You are not on the allowlist.' });
  }

  next();
});

// ─── Jira Name Resolution Cache ───

let jiraNameCache = null;

async function getNameCache() {
  if (jiraNameCache === null) {
    jiraNameCache = await readFromS3('jira-name-map.json') || {};
  }
  return jiraNameCache;
}

async function persistNameCache() {
  await writeToS3('jira-name-map.json', jiraNameCache || {});
}

// ─── Routes: Roster & Person Metrics ───

app.get('/roster', async function (req, res) {
  try {
    const roster = await readFromS3('roster.json');
    if (!roster) {
      return res.status(404).json({ error: 'Roster not found' });
    }
    res.json(roster);
  } catch (error) {
    console.error('Read roster error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/person/:jiraDisplayName/metrics', async function (req, res) {
  try {
    const name = decodeURIComponent(req.params.jiraDisplayName);
    const key = sanitizeFilename(name);
    const cachePath = `people/${key}.json`;
    const forceRefresh = req.query.refresh === 'true';

    // Check cache (4-hour TTL)
    if (!forceRefresh) {
      const cached = await readFromS3(cachePath);
      if (cached && cached.fetchedAt) {
        const age = Date.now() - new Date(cached.fetchedAt).getTime();
        if (age < CACHE_TTL_MS) {
          return res.json(cached);
        }
      }
    }

    // Fetch from Jira inline (2 parallel JQL queries, well within 25s timeout)
    const nameCache = await getNameCache();
    const metrics = await fetchPersonMetrics(jiraRequest, name, { nameCache });
    if (metrics._resolvedName) {
      await persistNameCache();
      delete metrics._resolvedName;
    }
    await writeToS3(cachePath, metrics);
    res.json(metrics);
  } catch (error) {
    console.error(`Person metrics error (${req.params.jiraDisplayName}):`, error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/team/:teamKey/metrics', async function (req, res) {
  try {
    const teamKey = decodeURIComponent(req.params.teamKey);
    const roster = await readFromS3('roster.json');
    if (!roster) {
      return res.status(404).json({ error: 'Roster not found' });
    }

    const team = roster.teams[teamKey];
    if (!team) {
      return res.status(404).json({ error: `Team "${teamKey}" not found in roster` });
    }

    // Deduplicate members by jiraDisplayName
    const seen = new Set();
    const uniqueMembers = team.members.filter(m => {
      if (seen.has(m.jiraDisplayName)) return false;
      seen.add(m.jiraDisplayName);
      return true;
    });

    let resolvedCount = 0;
    let resolvedPoints = 0;
    let inProgressCount = 0;
    let cycleTimesSum = 0;
    let cycleTimesCount = 0;
    const members = [];
    const resolvedIssues = [];

    for (const member of uniqueMembers) {
      const key = sanitizeFilename(member.jiraDisplayName);
      const cached = await readFromS3(`people/${key}.json`);
      const memberData = {
        name: member.name,
        jiraDisplayName: member.jiraDisplayName,
        specialty: member.specialty,
        metrics: null
      };

      if (cached) {
        memberData.metrics = {
          fetchedAt: cached.fetchedAt,
          resolvedCount: cached.resolved?.count || 0,
          resolvedPoints: cached.resolved?.storyPoints || 0,
          inProgressCount: cached.inProgress?.count || 0,
          avgCycleTimeDays: cached.cycleTime?.avgDays
        };
        resolvedCount += cached.resolved?.count || 0;
        resolvedPoints += cached.resolved?.storyPoints || 0;
        inProgressCount += cached.inProgress?.count || 0;
        if (cached.resolved?.issues) {
          for (const issue of cached.resolved.issues) {
            resolvedIssues.push({ ...issue, assignee: member.jiraDisplayName });
          }
        }
        if (cached.cycleTime?.avgDays != null) {
          cycleTimesSum += cached.cycleTime.avgDays;
          cycleTimesCount++;
        }
      }

      members.push(memberData);
    }

    res.json({
      teamKey,
      displayName: team.displayName,
      memberCount: uniqueMembers.length,
      aggregate: {
        resolvedCount,
        resolvedPoints,
        inProgressCount,
        avgCycleTimeDays: cycleTimesCount > 0 ? +(cycleTimesSum / cycleTimesCount).toFixed(1) : null
      },
      members,
      resolvedIssues
    });
  } catch (error) {
    console.error(`Team metrics error (${req.params.teamKey}):`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/roster/refresh', async function (req, res) {
  try {
    const roster = await readFromS3('roster.json');
    if (!roster) {
      return res.status(404).json({ error: 'Roster not found' });
    }

    // Collect unique member names across all teams
    const seen = new Set();
    for (const team of Object.values(roster.teams)) {
      for (const member of team.members) {
        seen.add(member.jiraDisplayName);
      }
    }
    const memberNames = [...seen];

    // Invoke Refresher Lambda asynchronously
    const refresherName = `teamTrackerRefresher-${process.env.ENV || 'dev'}`;
    const command = new InvokeCommand({
      FunctionName: refresherName,
      InvocationType: 'Event',
      Payload: JSON.stringify({ type: 'roster-refresh', members: memberNames })
    });
    await lambdaClient.send(command);

    res.json({ status: 'started', memberCount: memberNames.length });
  } catch (error) {
    console.error('Roster refresh error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/team/:teamKey/refresh', async function (req, res) {
  try {
    const teamKey = decodeURIComponent(req.params.teamKey);
    const roster = await readFromS3('roster.json');
    if (!roster) {
      return res.status(404).json({ error: 'Roster not found' });
    }

    const team = roster.teams[teamKey];
    if (!team) {
      return res.status(404).json({ error: `Team "${teamKey}" not found in roster` });
    }

    // Deduplicate members
    const seen = new Set();
    const memberNames = team.members
      .filter(m => {
        if (seen.has(m.jiraDisplayName)) return false;
        seen.add(m.jiraDisplayName);
        return true;
      })
      .map(m => m.jiraDisplayName);

    // Invoke Refresher Lambda asynchronously
    const refresherName = `teamTrackerRefresher-${process.env.ENV || 'dev'}`;
    const command = new InvokeCommand({
      FunctionName: refresherName,
      InvocationType: 'Event',
      Payload: JSON.stringify({ type: 'team-refresh', members: memberNames })
    });
    await lambdaClient.send(command);

    res.json({ status: 'started', memberCount: memberNames.length });
  } catch (error) {
    console.error(`Team refresh error (${req.params.teamKey}):`, error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/jira-name-cache', async function (req, res) {
  jiraNameCache = {};
  await writeToS3('jira-name-map.json', {});
  res.json({ success: true });
});

// ─── Routes: Annotations ───

app.get('/sprints/:sprintId/annotations', async function (req, res) {
  try {
    const { sprintId } = req.params;
    const data = await readFromS3(`annotations/${sprintId}.json`);
    res.json(data || { annotations: {} });
  } catch (error) {
    console.error('Read annotations error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/sprints/:sprintId/annotations', async function (req, res) {
  try {
    const { sprintId } = req.params;
    const { assignee, text } = req.body;
    if (!assignee || !text) {
      return res.status(400).json({ error: 'assignee and text are required' });
    }

    const data = await readFromS3(`annotations/${sprintId}.json`) || { annotations: {} };
    if (!data.annotations[assignee]) {
      data.annotations[assignee] = [];
    }

    const annotation = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text,
      author: req.userEmail,
      createdAt: new Date().toISOString()
    };

    data.annotations[assignee].push(annotation);
    await writeToS3(`annotations/${sprintId}.json`, data);
    res.json(annotation);
  } catch (error) {
    console.error('Save annotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/sprints/:sprintId/annotations/:assignee/:annotationId', async function (req, res) {
  try {
    const { sprintId, assignee, annotationId } = req.params;
    const data = await readFromS3(`annotations/${sprintId}.json`);
    if (!data?.annotations?.[assignee]) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    const before = data.annotations[assignee].length;
    data.annotations[assignee] = data.annotations[assignee].filter(a => a.id !== annotationId);

    if (data.annotations[assignee].length === before) {
      return res.status(404).json({ error: 'Annotation not found' });
    }

    if (data.annotations[assignee].length === 0) {
      delete data.annotations[assignee];
    }

    await writeToS3(`annotations/${sprintId}.json`, data);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete annotation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── Routes: Allowlist ───

app.get('/allowlist', async function (req, res) {
  try {
    const data = await readFromS3('allowlist.json') || { emails: [] };
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Read allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/allowlist', async function (req, res) {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalized = email.trim().toLowerCase();
    if (!normalized.endsWith('@redhat.com')) {
      return res.status(400).json({ error: 'Only @redhat.com email addresses are allowed' });
    }

    const data = await readFromS3('allowlist.json') || { emails: [] };
    if (data.emails.includes(normalized)) {
      return res.status(409).json({ error: 'Email is already on the allowlist' });
    }

    data.emails.push(normalized);
    await writeToS3('allowlist.json', data);
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Add to allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/allowlist/:email', async function (req, res) {
  try {
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const data = await readFromS3('allowlist.json') || { emails: [] };

    if (!data.emails.includes(email)) {
      return res.status(404).json({ error: 'Email not found on allowlist' });
    }

    if (data.emails.length <= 1) {
      return res.status(400).json({ error: 'Cannot remove the last user from the allowlist' });
    }

    data.emails = data.emails.filter(e => e !== email);
    await writeToS3('allowlist.json', data);
    res.json({ emails: data.emails });
  } catch (error) {
    console.error('Remove from allowlist error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = app;
