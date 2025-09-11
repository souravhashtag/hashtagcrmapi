// services/googleSheetService.js
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const CREDENTIALS_PATH = path.join(__dirname, '../config/credentials.json'); // service account JSON
const SPREADSHEET_ID = '10rZxnMvRW0DLnUui3bi6tr4eXcvfxWAAqefTf-n-dTs'; // e.g. 1FTDSSueG... from the sheet URL

function getAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
  });
  return auth;
}

async function addEODReport(report) {
  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });

  const tabName = report.date; // "4/9/2025" or better format e.g. "2025-09-04"

  // 1. Check if sheet (tab) exists
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === tabName);

  if (!sheet) {
    // 2. Create new tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title: tabName },
          },
        }],
      },
    });
  }

  // 3. Append data into that sheet tab
  const values = [
    ['Name of Employee', report.employeeName],
    ['Position', report.position],
    ['Department', report.department],
    ['Date', report.date],
    [],
    ['Activity', 'Start', 'End', 'Description', 'Status'],
    ...report.activities.map(a => [a.activity, a.start, a.end, a.description, a.status]),
    [],
    ['Plans for Tomorrow', report.plans || '-'],
    ['Issues', report.issues || '-'],
    ['Comments', report.comments || '-'],
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });

  return { success: true, message: `Report added to tab ${tabName}` };
}

module.exports = { addEODReport };
