export type Sound = {
  id: string;
  name: string;
  emoji: string;
  duration: number;
  favorite: boolean;
  category: string;
};

export type SoundCategory = {
  id: string;
  name: string;
  sounds: Sound[];
};
