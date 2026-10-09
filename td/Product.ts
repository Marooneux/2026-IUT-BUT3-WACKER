// Translated from Models/{Product,Price,Notification,Supplier,Warehouse}.cs
//
// Prisma persists the fields of Price as flattened Product columns
// (priceAmount, priceCurrency, priceMargin and priceVat). The Price object
// remains the domain representation, so Product methods must keep the
// in-memory Price fields and their corresponding Prisma columns synchronized.

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_MARGIN_PERCENTAGE = 15;
const DEFAULT_VAT_PERCENTAGE = 20;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export type Channel = "email" | "sms" | "push";
export type ProductStatus = "active" | "out_of_stock" | "deprecated";

export class InsufficientStockError extends Error {
  name = "InsufficientStockError";
}

export class DiscountError extends Error {
  name = "DiscountError";
}

export class SupplierNotFoundError extends Error {
  name = "SupplierNotFoundError";
}

export interface Notification {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  channel: Channel;
  sentAt: Date;
  productId?: string;
}

export class Supplier {
  constructor(
    public id: string,
    public name: string,
    public email: string,
    public region: string,
  ) {}
}

export class Warehouse {
  constructor(
    public id: string,
    public name: string,
    public address: string,
    public region: string,
  ) {}
}

export class Price {
  amount: number;
  currency: string;
  margin: number; // percentage
  vat: number; // percentage, applied on margin only

  constructor(amount: number, currency: string) {
    this.amount = amount;
    this.currency = currency;
    this.margin = DEFAULT_MARGIN_PERCENTAGE;
    this.vat = DEFAULT_VAT_PERCENTAGE;
  }

  getResellerPrice(): number {
    const marginAmount = (this.amount * this.margin) / 100;
    const vatAmount = (marginAmount * this.vat) / 100;
    return this.amount + marginAmount + vatAmount;
  }
}

export class Product {
  id: string;
  name: string;
  slug: string;
  price: Price;
  discounts: string[];
  images: Record<string, string>; // key = context ("thumbnail", "hero", ...), value = url
  suppliersRegions: Map<string, Supplier>; // key = region
  weight: number;
  dimensions: string;
  quantity: number;
  stock: number;
  warehouse: Warehouse | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
  notifications: Notification[] = [];
  validUntil: Date | null = null;

  constructor(
    id: string,
    name: string,
    slogan: string,
    price: Price,
    discounts: string[],
    images: Record<string, string>,
    suppliersRegions: Map<string, Supplier>,
    weight: number,
    dimensions: string,
    quantity: number,
    stock: number,
    warehouse: Warehouse | null,
  ) {
    this.id = id;
    this.name = name;
    this.slug = slogan;
    this.price = price;
    this.discounts = discounts;
    this.images = images;
    this.suppliersRegions = suppliersRegions;
    this.weight = weight;
    this.dimensions = dimensions;
    this.quantity = quantity;
    this.stock = stock;
    this.warehouse = warehouse;
    this.status = "active";
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  getDisplayLabel(): string {
    if (this.status === "deprecated") {
      return `[DISCONTINUED] ${this.name}`;
    }

    if (this.stock === 0) {
      return `[OUT OF STOCK] ${this.name}`;
    }

    return this.name;
  }

  // --- Catalog / images / discounts ---
  
  async addImage(context: string, url: string): Promise<void> {
    if (!url) throw new Error("url is required");
    if (!isHttpUrl(url)) throw new Error("url must start with http");

    const key =
      this.images[context] === undefined
        ? context
        : this.imageKeyFromRequiredSupplier(context);
    this.images[key] = url;
    this.updatedAt = new Date();
    await prisma.product.update({
      where: { id: this.id },
      data: { images: this.images as Prisma.InputJsonValue, updatedAt: this.updatedAt },
    });
  }

  // When an image already exists for this context, the new one is stored under
  // a key derived from the FIRST regional supplier (Map insertion order).
  private imageKeyFor(context: string): string {
    const [supplier] = this.suppliersRegions.values();
    if (!supplier) return context;
    if (!supplier.region) return this.warehouse ? `${context}-${this.warehouse.name}` : context;
    if (!supplier.email) return `${context}-supplier`;
    if (!EMAIL_REGEX.test(supplier.email)) {
      throw new Error(`Supplier ${supplier.name} has a malformed email: ${supplier.email}`);
    }
    return `${context}-${supplier.name}`;
  }

  private imageKeyFromRequiredSupplier(context: string): string {
    const supplier = this.suppliersRegions.values().next().value as Supplier | undefined;

    if (!supplier) {
      throw new Error("A supplier is required to replace an existing image");
    }

    if (!supplier.region) {
      throw new Error(`Supplier ${supplier.name} has no region`);
    }

    if (!supplier.email) {
      throw new Error(`Supplier ${supplier.name} has no email`);
    }

    if (!EMAIL_REGEX.test(supplier.email)) {
      throw new Error(`Supplier ${supplier.name} has a malformed email: ${supplier.email}`);
    }

    return `${context}-${supplier.name}`;
  }

  getValidUntil(): Date | null {
    return this.validUntil;
  }

  setValidUntil(validUntil: Date | null): void {
    this.validUntil = validUntil;
  }

  async addDiscount(discountCode: string, validUntil: Date): Promise<void> {
    if (!discountCode) {
      throw new DiscountError("discountCode is required");
    }

    if (validUntil < new Date()) {
      throw new DiscountError("validUntil cannot be in the past");
    }

    if (this.discounts.length >= 2) {
      throw new DiscountError("Cannot have more than 2 discounts at the same time");
    }

    this.discounts.push(discountCode);
    this.setValidUntil(validUntil);
    this.updatedAt = new Date();
    await prisma.product.update({
      where: { id: this.id },
      data: { discounts: this.discounts, updatedAt: this.updatedAt },
    });
  }

  // --- Suppliers ---

  async addSupplierToRegion(region: string, suppliersList: Supplier[]): Promise<void> {
    const suppliers = suppliersList.find((x) => x.region === region);
    if (!suppliers) throw new SupplierNotFoundError(`No supplier found for region ${region}`);

    this.suppliersRegions.set(region, suppliers);
    this.updatedAt = new Date();

    await prisma.productSupplier.upsert({
      where: { productId_region: { productId: this.id, region: region } },
      create: { productId: this.id, region: region, supplierId: suppliers.id },
      update: { supplierId: suppliers.id },
    });
  }

  // --- Pricing ---

  getResellerPrice(): number {
    const marginAmount = (this.price.amount * this.price.margin) / 100;
    const vatAmount = (marginAmount * this.price.vat) / 100;
    return this.price.amount + marginAmount + vatAmount;
  }

  async setMargin(marginPercentage: number): Promise<void> {
    this.price.margin = marginPercentage;
    this.updatedAt = new Date();
    await prisma.product.update({
      where: { id: this.id },
      data: { priceMargin: marginPercentage, updatedAt: this.updatedAt },
    });
  }

  // --- Stock ---

  async receiveStock(quantity: number): Promise<void> {
    this.stock += quantity;
    this.quantity += quantity;
    this.updatedAt = new Date();
    console.log(`Restocking ${this.name} at ${this.warehouse ? this.warehouse.name : "no warehouse"}`);
    await prisma.product.update({
      where: { id: this.id },
      data: { stock: this.stock, quantity: this.quantity, updatedAt: this.updatedAt },
    });
  }

  async sell(quantity: number): Promise<void> {
    if (this.stock < quantity) throw new InsufficientStockError("Not enough stock");

    this.stock -= quantity;
    this.updatedAt = new Date();

    if (this.stock === 0) {
      this.status = "out_of_stock";
    }

    await prisma.product.update({
      where: { id: this.id },
      data: { stock: this.stock, status: this.status, updatedAt: this.updatedAt },
    });

    // Notify all regional suppliers
    this.notifySuppliers(`Product sold: ${this.name}`, `${quantity} unit(s) of ${this.name} were sold. Remaining stock: ${this.stock}.`);
  }

  // --- Lifecycle ---

  async deprecate(): Promise<void> {
    this.status = "deprecated";
    this.stock = 0;
    this.updatedAt = new Date();

    await prisma.product.update({
      where: { id: this.id },
      data: { status: this.status, stock: this.stock, updatedAt: this.updatedAt },
    });

    // Notify all regional suppliers
    this.notifySuppliers(`Product deprecated: ${this.name}`, `The product ${this.name} has been deprecated and removed from the catalog.`);

    // Notify customers
    this.notifications.push(this.mkNotif("customers@omniproduct.com", `Product no longer available: ${this.name}`, `${this.name} is no longer available.`));
  }

  // small helper to cut down repetition in notif building
  private notifySuppliers(subject: string, body: string): void {
    for (const [, supplier] of this.suppliersRegions) {
      this.notifications.push(this.mkNotif(supplier.email, subject, body));
    }
  }

  private mkNotif(recipient: string, subject: string, body: string): Notification {
    return {
      id: crypto.randomUUID(),
      recipient: recipient,
      subject: subject,
      body: body,
      channel: "email",
      sentAt: new Date(),
      productId: this.id,
    };
  }
}
