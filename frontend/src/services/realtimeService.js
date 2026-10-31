import supabase, { isSupabaseConfigured } from '../lib/supabaseClient';

export const realtimeService = {
  /**
   * Subscribes to real-time notification inserts/updates for a specific user
   */
  subscribeToNotifications(userId, onNotificationReceived) {
    if (!isSupabaseConfigured || !userId) {
      return { unsubscribe: () => {} };
    }

    const channelName = `public:notifications:user_${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          onNotificationReceived(payload);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },

  /**
   * Subscribes to application status updates (e.g. for Candidate Application Timeline or HR ATS)
   */
  subscribeToApplicationStatus(applicationId, onStatusChange) {
    if (!isSupabaseConfigured || !applicationId) {
      return { unsubscribe: () => {} };
    }

    const channelName = `public:applications:${applicationId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'applications',
          filter: `id=eq.${applicationId}`,
        },
        (payload) => {
          onStatusChange(payload.new);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};

export default realtimeService;
