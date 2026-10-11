import type { Notification, Supplier } from "./Product";

export class NotificationService {
  private readonly customersEmail = "customers@omniproduct.com";

  productSold(productId: string, productName: string, quantity: number, remainingStock: number, suppliers: Supplier[]): Notification[] {
    return suppliers.map((supplier) =>
      this.email(
        supplier.email,
        `Product sold: ${productName}`,
        `${quantity} unit(s) of ${productName} were sold. Remaining stock: ${remainingStock}.`,
        productId,
      ),
    );
  }

  productDeprecated(productId: string, productName: string, suppliers: Supplier[]): Notification[] {
    const supplierNotifications = suppliers.map((supplier) =>
      this.email(
        supplier.email,
        `Product deprecated: ${productName}`,
        `The product ${productName} has been deprecated and removed from the catalog.`,
        productId,
      ),
    );
    const customerNotification = this.email(
      this.customersEmail,
      `Product no longer available: ${productName}`,
      `${productName} is no longer available.`,
      productId,
    );
    return [...supplierNotifications, customerNotification];
  }

  private email(recipient: string, subject: string, body: string, productId: string): Notification {
    return {
      id: crypto.randomUUID(),
      recipient,
      subject,
      body,
      channel: "email",
      sentAt: new Date(),
      productId,
    };
  }
}
