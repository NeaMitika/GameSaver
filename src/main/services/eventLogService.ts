import { v4 as uuid } from 'uuid';
import { EventLogType } from '../../shared/types';
import { AppDb, persistDb } from './db';

export function logEvent(db: AppDb, gameId: string | null, type: EventLogType, message: string): void {
  db.state.eventLogs.push({
    id: uuid(),
    game_id: gameId,
    type,
    message,
    created_at: new Date().toISOString()
  });
  persistDb(db);
}

