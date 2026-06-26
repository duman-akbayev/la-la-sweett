/**
 * Analytics Service — weekly metrics from Supabase
 */

import { getSupabaseAdmin, isDbConfigured } from '@/lib/supabase';
import type { Channel, WeeklyReport } from '@/types';

function emptyChannelCounts(): Record<Channel, number> {
  return { whatsapp: 0, instagram: 0, chat_widget: 0 };
}

function getWeekRange(reference = new Date()): { weekStart: Date; weekEnd: Date } {
  const weekStart = new Date(reference);
  const day = weekStart.getDay();
  const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return { weekStart, weekEnd };
}

function countTopics(intentTags: string[][]): { topic: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const tags of intentTags) {
    for (const tag of tags) {
      const normalized = tag.trim();
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/**
 * Fetches the current week's analytics from Supabase.
 */
export async function getWeeklyAnalyticsFromDb(): Promise<WeeklyReport> {
  const { weekStart, weekEnd } = getWeekRange();

  if (!isDbConfigured()) {
    return {
      weekStarting: weekStart,
      weekEnding: new Date(weekEnd.getTime() - 1),
      totalConversationsByChannel: emptyChannelCounts(),
      topTopics: [],
      conversionRate: 0,
      averageResponseTimeByChannel: emptyChannelCounts(),
      orderSummary: {
        total: 0,
        inquiries: 0,
        confirmed: 0,
        inProduction: 0,
        completed: 0,
        revenue: 0,
      },
    };
  }

  const supabase = getSupabaseAdmin();
  const weekStartIso = weekStart.toISOString();
  const weekEndIso = weekEnd.toISOString();

  const [conversationsResult, ordersResult] = await Promise.all([
    supabase
      .from('conversations')
      .select('channel, intent_tags')
      .gte('started_at', weekStartIso)
      .lt('started_at', weekEndIso),
    supabase
      .from('orders')
      .select('state, originating_channel, quoted_price')
      .gte('created_at', weekStartIso)
      .lt('created_at', weekEndIso),
  ]);

  if (conversationsResult.error) {
    throw new Error(`Failed to fetch conversations: ${conversationsResult.error.message}`);
  }
  if (ordersResult.error) {
    throw new Error(`Failed to fetch orders: ${ordersResult.error.message}`);
  }

  const conversations = conversationsResult.data ?? [];
  const orders = ordersResult.data ?? [];

  const totalConversationsByChannel = emptyChannelCounts();
  for (const conversation of conversations) {
    const channel = conversation.channel as Channel;
    if (channel in totalConversationsByChannel) {
      totalConversationsByChannel[channel] += 1;
    }
  }

  const ordersByChannel = emptyChannelCounts();
  let inquiries = 0;
  let confirmed = 0;
  let inProduction = 0;
  let completed = 0;
  let revenue = 0;

  for (const order of orders) {
    const channel = order.originating_channel as Channel;
    if (channel in ordersByChannel) {
      ordersByChannel[channel] += 1;
    }

    switch (order.state) {
      case 'Inquiry':
      case 'Quoted':
        inquiries += 1;
        break;
      case 'Confirmed':
      case 'Deposit_Received':
        confirmed += 1;
        break;
      case 'In_Production':
      case 'Ready':
        inProduction += 1;
        break;
      case 'Delivered':
      case 'Picked_Up':
        completed += 1;
        revenue += Number(order.quoted_price ?? 0);
        break;
    }
  }

  const activeOrders = orders.filter((o) => o.state !== 'Cancelled').length;
  const conversionRate =
    conversations.length > 0 ? activeOrders / conversations.length : activeOrders > 0 ? 1 : 0;

  return {
    weekStarting: weekStart,
    weekEnding: new Date(weekEnd.getTime() - 1),
    totalConversationsByChannel,
    topTopics: countTopics(conversations.map((c) => c.intent_tags ?? [])),
    conversionRate,
    averageResponseTimeByChannel: emptyChannelCounts(),
    orderSummary: {
      total: orders.filter((o) => o.state !== 'Cancelled').length,
      inquiries,
      confirmed,
      inProduction,
      completed,
      revenue,
    },
    ordersByChannel,
  };
}
