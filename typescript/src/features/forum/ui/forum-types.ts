export type ForumPost = {
  id: string;
  title: string;
  content: string;
  author: { id: string; displayName: string; avatar: string | null };
  tags: ForumTag[];
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  pinned: boolean;
  locked: boolean;
  image?: string;
};

export type ForumTag = {
  id: string;
  name: string;
  color: string;
};
