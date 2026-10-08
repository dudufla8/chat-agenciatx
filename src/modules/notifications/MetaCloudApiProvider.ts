import { INotificationProvider } from './INotificationProvider';
import { env } from '../../config/env';

export class MetaCloudApiProvider implements INotificationProvider {
  private phoneNumberId: string;
  private accessToken: string;
  private verifyToken: string;

  constructor() {
    this.phoneNumberId = env.META_WA_PHONE_NUMBER_ID;
    this.accessToken = env.META_WA_ACCESS_TOKEN;
    this.verifyToken = env.META_WA_WEBHOOK_VERIFY_TOKEN;
  }

  getVerifyToken(): string {
    return this.verifyToken;
  }

  /**
   * Sends a pre-approved Meta WhatsApp Template message
   */
  async sendTemplateMessage(to: string, templateName: string, params: string[]): Promise<boolean> {
    const cleanTo = to.replace(/\D/g, '');

    // If credentials are not set, act as structured logger / simulation
    if (!this.phoneNumberId || !this.accessToken) {
      console.info(
        `[MetaCloudApiProvider:MOCK] Template "${templateName}" directed to +${cleanTo} with params:`,
        params
      );
      return true;
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;

      const body = {
        messaging_product: 'whatsapp',
        to: cleanTo,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'pt_BR' },
          components: [
            {
              type: 'body',
              parameters: params.map((param) => ({
                type: 'text',
                text: param,
              })),
            },
          ],
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[MetaCloudApiProvider] Error sending message: ${res.status}`, errorText);
        return false;
      }

      const json = await res.json();
      console.info(`[MetaCloudApiProvider] Message successfully queued, ID: ${json.messages?.[0]?.id}`);
      return true;
    } catch (err: any) {
      console.error('[MetaCloudApiProvider] Exception during WhatsApp send:', err.message);
      return false;
    }
  }
}

export const metaCloudApiProvider = new MetaCloudApiProvider();
