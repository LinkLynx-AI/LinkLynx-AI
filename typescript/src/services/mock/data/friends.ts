import type { Relationship, RelationshipType } from "@/services/api-client";
import { mockUsers } from "./users";

// Friends: 花子, 次郎 are friends
// Incoming request from さくら
// Outgoing request to ゆき
// Blocked: none initially
export const mockFriendships: Relationship[] = [
  {
    id: "rel-1",
    type: 1 as RelationshipType, // friend
    user: mockUsers[1], // 花子
  },
  {
    id: "rel-2",
    type: 1 as RelationshipType, // friend
    user: mockUsers[2], // 次郎
  },
  {
    id: "rel-3",
    type: 3 as RelationshipType, // incoming request
    user: mockUsers[3], // さくら
  },
  {
    id: "rel-4",
    type: 4 as RelationshipType, // outgoing request
    user: mockUsers[5], // ゆき
  },
];
