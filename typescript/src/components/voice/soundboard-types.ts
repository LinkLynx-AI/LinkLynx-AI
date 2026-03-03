export interface Sound {
  id: string;
  name: string;
  emoji: string;
  duration: number;
  favorite: boolean;
  category: string;
}

export interface SoundCategory {
  id: string;
  name: string;
  sounds: Sound[];
}
