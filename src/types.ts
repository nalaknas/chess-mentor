export type ThemeTag =
  | 'pin'
  | 'fork'
  | 'skewer'
  | 'discovered_attack'
  | 'double_attack'
  | 'hanging_piece'
  | 'back_rank'
  | 'weak_king'
  | 'overloaded_piece'
  | 'trapped_piece'
  | 'weak_square'
  | 'bad_bishop'
  | 'good_knight'
  | 'open_file'
  | 'pawn_break'
  | 'pawn_structure'
  | 'passed_pawn'
  | 'premature_attack'
  | 'missed_defense'
  | 'opening_principle'
  | 'piece_development'
  | 'king_safety'
  | 'simplification'
  | 'endgame_technique'
  | 'time_trouble'
  | 'calculation_error';

export type Classification =
  | 'best'
  | 'good'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder';

export type AnalysisStatus =
  | 'pending'
  | 'engine_done'
  | 'fully_analyzed'
  | 'error';

export type GameResult = '1-0' | '0-1' | '1/2-1/2' | '*';

export type GameSource = 'paste' | 'lichess' | 'chesscom';

export type Color = 'white' | 'black';

export interface UserProfile {
  id: 'default';
  displayName?: string;
  currentElo: number;
  teachingElo: number;
  preferredColor?: Color;
  createdAt: number;
}

export interface Position {
  ply: number;
  fen: string;
  moveSan?: string;
  moveUci?: string;
  engineEval?: number;
  engineBestMove?: string;
  engineBestMoveSan?: string;
  enginePv?: string[];
  evalDrop?: number;
  isKeyMoment: boolean;
  classification?: Classification;
}

export interface Game {
  id: string;
  pgn: string;
  white: string;
  black: string;
  result: GameResult;
  date: string;
  source: GameSource;
  userColor: Color;
  importedAt: number;
  analysisStatus: AnalysisStatus;
  positions: Position[];
}
