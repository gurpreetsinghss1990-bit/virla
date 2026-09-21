/**
 * Lightweight internationalization (i18n) translation helper for Virla
 */
const DICTIONARY: Record<string, string> = {
  'wallet.recipient_not_found': "This person isn't on Virla yet.",
  'wallet.invite_whatsapp': 'Invite via WhatsApp',
  'wallet.invited_whatsapp': 'Invited on WhatsApp ✓',
  'wallet.more_options': 'More',
  'wallet.share_sms': 'Share / SMS',
  'wallet.invite_message_body': 'wants to send you workout & wellness session credits on Virla!',
  'wallet.invite_message_cta': 'Download the Virla app to claim your credits:',
  'wallet.rate_limit_exceeded': 'Invite limit reached. You can send up to 10 invites every 24 hours to prevent spam.',
  'wallet.invite_logged': 'Invitation Logged ✉️',
  'wallet.invite_logged_desc': 'Invitation to join Virla has been recorded.',
  'wallet.whatsapp_not_installed': 'WhatsApp is not installed. Opening sharing options...',
};

export function t(key: string, fallback?: string): string {
  return DICTIONARY[key] || fallback || key;
}
