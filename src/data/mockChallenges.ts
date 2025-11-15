import { Challenge } from '../types';
import { DiscordChannel } from '../types';

export const mockChallenges: Challenge[] = [
  {
    id: 'chal-1',
    name: 'November Scalps',
    scope: 'admin',
    defaultChannel: 'scalps',
    createdAt: new Date('2025-11-01'),
  },
  {
    id: 'chal-2',
    name: 'TSLA Earnings Week',
    scope: 'honeydrip-wide',
    defaultChannel: 'tsla-plays',
    createdAt: new Date('2025-11-10'),
  },
  {
    id: 'chal-3',
    name: 'SPX 0DTE Master',
    scope: 'admin',
    createdAt: new Date('2025-11-05'),
  },
];

export const mockDiscordChannels: DiscordChannel[] = [
  {
    id: 'dc-1',
    name: 'scalps',
    webhookUrl: 'https://discord.com/api/webhooks/123456789/abcdefghijklmnop',
    createdAt: new Date('2025-11-01'),
  },
  {
    id: 'dc-2',
    name: 'day-trades',
    webhookUrl: 'https://discord.com/api/webhooks/234567890/bcdefghijklmnopq',
    createdAt: new Date('2025-11-01'),
  },
  {
    id: 'dc-3',
    name: 'swings',
    webhookUrl: 'https://discord.com/api/webhooks/345678901/cdefghijklmnopqr',
    createdAt: new Date('2025-11-01'),
  },
  {
    id: 'dc-4',
    name: 'leaps',
    webhookUrl: 'https://discord.com/api/webhooks/456789012/defghijklmnopqrs',
    createdAt: new Date('2025-11-02'),
  },
  {
    id: 'dc-5',
    name: 'alerts',
    webhookUrl: 'https://discord.com/api/webhooks/567890123/efghijklmnopqrst',
    createdAt: new Date('2025-11-02'),
  },
  {
    id: 'dc-6',
    name: 'tsla-plays',
    webhookUrl: 'https://discord.com/api/webhooks/678901234/fghijklmnopqrstu',
    createdAt: new Date('2025-11-10'),
  },
];
