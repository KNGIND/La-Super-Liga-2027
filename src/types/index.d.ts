/* Modelo de datos de La Súper Liga 2027.
   Si agregás un campo nuevo: tipo acá → src/services/data/schema.ts (columna) → supabase/migrations. */

export type Id = string;

export type MatchStatus = 'upcoming' | 'live' | 'paused' | 'finished';
export type CompetitionKind = 'liga' | 'copa' | 'amistoso';
export type Position = 'POR' | 'DEF' | 'MED' | 'DEL' | '';
export type EventType = 'goal' | 'own_goal' | 'pen_goal' | 'yellow' | 'red';

export interface League {
  id: number;
  name: string;
  short: string;
  season: string;
  seasonStatus: string;
  tagline: string;
  info: string;
  rules: string;
  pointsWin: number;
  pointsDraw: number;
  pointsLoss: number;
  /** Cuántos equipos de arriba se marcan como zona de clasificación. */
  zoneTop: number;
  /** Cuántos equipos de abajo se marcan como zona de descenso. */
  zoneBottom: number;
  logo: string;
}

export interface Season { id: Id; name: string; status: string; current: boolean }
export interface Competition { id: Id; name: string; kind: CompetitionKind }

export interface Team {
  id: Id;
  name: string;
  short: string;
  color: string;
  color2: string;
  logo: string;
  /** Ajuste manual de puntos (sanciones, premios). */
  adjust: number;
}

export interface Player { id: Id; teamId: Id; number: number; name: string; pos: Position }

export interface LineupPlayer { number: number; name: string; pos: string }
export interface MatchEvent { minute: number; type: EventType; side: 'home' | 'away'; player: string }

export interface Match {
  id: Id;
  seasonId: Id;
  competitionId: Id;
  round: string;
  leg: 'ida' | 'vuelta' | null;
  firstLeg: string;
  homeId: Id;
  awayId: Id;
  /** ISO 8601 con zona horaria. */
  kickoff: string;
  status: MatchStatus;
  minute: number;
  homeScore: number | null;
  awayScore: number | null;
  /** Penales "local-visitante", por ejemplo "5-4". */
  pens: string;
  stadium: string;
  channelId: Id;
  /** Código de sala de la transmisión privada. */
  room: string;
  homeFormation: string;
  awayFormation: string;
  homeLineup: LineupPlayer[];
  awayLineup: LineupPlayer[];
  events: MatchEvent[];
  notes: string;
}

export interface NewsItem {
  id: Id;
  kind: 'news' | 'announcement';
  title: string;
  category: string;
  summary: string;
  body: string;
  image: string;
  publishedAt: string;
  pinned: boolean;
}

export interface Channel { id: Id; name: string; logo: string; url: string }
export interface Sanction { id: Id; player: string; teamId: Id; type: string; duration: string; notes: string }

export interface AppNotification {
  id: Id;
  kind: 'match' | 'result' | 'news' | 'announcement' | 'activity';
  title: string;
  body: string;
  link: string;
  createdAt: string;
}

export interface Prediction {
  matchId: Id;
  home: number;
  away: number;
  createdAt: string;
  /** Puntos otorgados. null = todavía sin calcular. */
  points: number | null;
  /** false = guardada solo en este dispositivo, pendiente de enviar al servidor. */
  synced: boolean;
}

export interface LeaderboardRow { userId: Id; name: string; points: number; exact: number; predictions: number }

/** Todo lo que la app necesita para dibujar sus pantallas. */
export interface Dataset {
  league: League;
  seasons: Season[];
  competitions: Competition[];
  teams: Team[];
  players: Player[];
  matches: Match[];
  news: NewsItem[];
  channels: Channel[];
  sanctions: Sanction[];
  notifications: AppNotification[];
}

export type TableName = Exclude<keyof Dataset, 'league'>;

export type UserRole = 'user' | 'editor' | 'admin';
export interface UserProfile {
  id: Id;
  email: string;
  name: string;
  role: UserRole;
  favoriteTeams: Id[];
  favoritePlayers: Id[];
}
