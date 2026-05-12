import Dexie, { type EntityTable } from 'dexie';
import type { Game } from './types';

export class ChessMentorDB extends Dexie {
  games!: EntityTable<Game, 'id'>;

  constructor() {
    super('ChessMentorDB');
    this.version(1).stores({
      games: 'id, importedAt',
    });
  }
}

export const db = new ChessMentorDB();
