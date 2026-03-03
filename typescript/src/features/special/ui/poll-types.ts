export type PollData = {
  id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  expiresAt: string | null;
  expired: boolean;
  multiSelect: boolean;
};

export type PollOption = {
  id: string;
  text: string;
  votes: number;
  voted: boolean;
  emoji?: string;
};
