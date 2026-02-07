import path from 'path';

interface DetectInput {
  name: string;
  installPath: string;
}

export function detectSaveLocations(input: DetectInput): string[] {
  const gameName = sanitizeName(input.name);

  const candidates: string[] = [];
  const userProfile = process.env.USERPROFILE || '';
  const appData = process.env.APPDATA || '';
  const localAppData = process.env.LOCALAPPDATA || '';
  const programData = process.env.PROGRAMDATA || '';

  if (userProfile) {
    candidates.push(path.join(userProfile, 'Documents', 'My Games', gameName));
  }
  if (appData) {
    candidates.push(path.join(appData, gameName));
  }
  if (localAppData) {
    candidates.push(path.join(localAppData, gameName));
  }
  if (programData) {
    candidates.push(path.join(programData, gameName));
  }

  if (input.installPath) {
    candidates.push(path.join(input.installPath, 'Save'));
    candidates.push(path.join(input.installPath, 'Saves'));
    candidates.push(path.join(input.installPath, 'Profiles'));
  }

  return Array.from(new Set(candidates));
}

function sanitizeName(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]/g, '');
}
