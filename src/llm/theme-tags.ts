// The complete theme taxonomy (spec section 9). Kept here so prompts
// can render the list and the parser can validate Claude's response
// against it.
import type { ThemeTag } from '../types';

export const THEME_TAGS: ThemeTag[] = [
  // Tactical
  'pin',
  'fork',
  'skewer',
  'discovered_attack',
  'double_attack',
  'hanging_piece',
  'back_rank',
  'overloaded_piece',
  'trapped_piece',
  'weak_king',
  // Positional
  'weak_square',
  'bad_bishop',
  'good_knight',
  'open_file',
  'pawn_break',
  'pawn_structure',
  'passed_pawn',
  // Strategic / decision-making
  'premature_attack',
  'missed_defense',
  'opening_principle',
  'piece_development',
  'king_safety',
  'simplification',
  'endgame_technique',
  'time_trouble',
  'calculation_error',
];

const TAG_SET = new Set<string>(THEME_TAGS);

export function isThemeTag(value: unknown): value is ThemeTag {
  return typeof value === 'string' && TAG_SET.has(value);
}
