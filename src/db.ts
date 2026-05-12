import Dexie, { type EntityTable } from 'dexie';
import type {
  Analysis,
  Conversation,
  Game,
  UserProfile,
} from './types';

export class ChessMentorDB extends Dexie {
  userProfile!: EntityTable<UserProfile, 'id'>;
  games!: EntityTable<Game, 'id'>;
  analyses!: EntityTable<Analysis, 'id'>;
  conversations!: EntityTable<Conversation, 'id'>;

  constructor() {
    super('ChessMentorDB');

    // v1 was a Phase 1 placeholder with only `games`. v2 adds the
    // full schema from spec section 5. Compound [gameId+ply] indexes
    // let Phase 4 / 5 look up "the analysis / conversation for this
    // exact position" cheaply.
    this.version(1).stores({
      games: 'id, importedAt',
    });
    this.version(2).stores({
      userProfile: 'id',
      games: 'id, importedAt',
      analyses: 'id, gameId, [gameId+ply]',
      conversations: 'id, gameId, [gameId+ply]',
    });
  }
}

export const db = new ChessMentorDB();
