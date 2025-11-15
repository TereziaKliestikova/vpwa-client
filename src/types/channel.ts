export interface Channel {
  id: number;
  name: string;
  type: 'public' | 'private';
  messages: { id: number; user: string; text: string }[];
  members?: number[];
  isAdmin?: boolean;
}
