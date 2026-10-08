export interface INotificationProvider {
  sendTemplateMessage(to: string, templateName: string, params: string[]): Promise<boolean>;
}
