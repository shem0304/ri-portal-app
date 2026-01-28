import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';

function readJson(fileName) {
  const p = path.join(DATA_DIR, fileName);
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw);
}

export function loadAllData() {
  const localInstitutes = readJson('local_institutes.json');
  const nationalInstitutes = readJson('national_institutes.json');
  const localReports = readJson('local_reports.json');
  const nationalReports = readJson('national_reports.json');

  return {
    localInstitutes,
    nationalInstitutes,
    localReports,
    nationalReports,
  };
}
