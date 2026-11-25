export interface ChatItem {
  id: string;
  bookingId?: string;
  name: string;
  subtitle?: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unread: boolean;
  isOnline?: boolean;
  type: 'coach' | 'concierge';
}

