// Translated from Models/{Product,Price,Notification,Supplier,Warehouse}.cs
//
// Prisma persists the fields of Price as flattened Product columns
// (priceAmount, priceCurrency, priceMargin and priceVat). The Price object
// remains the domain representation, so Product methods must keep the
// in-memory Price fields and their corresponding Prisma columns synchronized.

import { NotificationService } from "./NotificationService";

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

// Allowed status transitions. "deprecated" is final.
const ALLOWED_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  active: ["out_of_stock", "deprecated"],
  out_of_stock: ["active", "deprecated"],
  deprecated: [],
};

export class InsufficientStockError extends Error {
  name = "InsufficientStockError";
}

export class DiscountError extends Error {
  name = "DiscountError";
}

export class ProductStatusError extends Error {
  name = "ProductStatusError";
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

  getImageKey(context: string): string {
    if (!this.region) {
      throw new Error(`Supplier ${this.name} has no region`);
    }

    if (!this.email) {
      throw new Error(`Supplier ${this.name} has no email`);
    }

    if (!EMAIL_REGEX.test(this.email)) {
      throw new Error(`Supplier ${this.name} has a malformed email: ${this.email}`);
    }

    return `${context}-${this.name}`;
  }
}

export class Warehouse {
  constructor(
    public id: string,
    public name: string,
    public address: string,
    public region: string,
  ) {}

  getRestockingLocation(): string {
    return this.name;
  }
}

export interface ProductChanges {
  stock?: number;
  quantity?: number;
  status?: ProductStatus;
  discounts?: string[];
  images?: Record<string, string>;
  priceMargin?: number;
  updatedAt: Date;
}

export interface ProductRepository {
  update(productId: string, changes: ProductChanges): Promise<void>;
  saveSupplier(productId: string, region: string, supplierId: string): Promise<void>;
  findSuppliers(productId: string): Promise<Map<string, Supplier>>;
  saveNotifications(notifications: Notification[]): Promise<void>;
}

export class InMemoryProductRepository implements ProductRepository {
  async update(): Promise<void> {}

  async saveSupplier(): Promise<void> {}

  async findSuppliers(): Promise<Map<string, Supplier>> {
    return new Map();
  }

  async saveNotifications(): Promise<void> {}
}

const notificationService = new NotificationService();

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

  setMargin(marginPercentage: number): void {
    this.margin = marginPercentage;
  }
}

// Consistency policy: every mutator writes to the database FIRST and updates
// the in-memory object only once the write has succeeded. If the repository throws,
// the Product is left exactly as it was before the call.
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
    private readonly repository: ProductRepository = new InMemoryProductRepository(),
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
    const newImages = { ...this.images, [key]: url };
    const now = new Date();

    await this.repository.update(this.id, { images: newImages, updatedAt: now });

    this.images = newImages;
    this.updatedAt = now;
  }

  private imageKeyFromRequiredSupplier(context: string): string {
    const supplier = this.suppliersRegions.values().next().value as Supplier | undefined;

    if (!supplier) {
      throw new Error("A supplier is required to replace an existing image");
    }

    return supplier.getImageKey(context);
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

    const newDiscounts = [...this.discounts, discountCode];
    const now = new Date();

    await this.repository.update(this.id, { discounts: newDiscounts, updatedAt: now });

    this.discounts = newDiscounts;
    this.setValidUntil(validUntil);
    this.updatedAt = now;
  }

  // --- Suppliers ---

  async loadSuppliers(): Promise<void> {
    this.suppliersRegions = await this.repository.findSuppliers(this.id);
  }

  async addSupplierToRegion(region: string, suppliersList: Supplier[]): Promise<void> {
    const suppliers = suppliersList.find((x) => x.region === region);
    if (!suppliers) throw new SupplierNotFoundError(`No supplier found for region ${region}`);

    await this.repository.saveSupplier(this.id, region, suppliers.id);

    this.suppliersRegions.set(region, suppliers);
    this.updatedAt = new Date();
  }

  // --- Pricing ---

  getResellerPrice(): number {
    return this.price.getResellerPrice();
  }

  async setMargin(marginPercentage: number): Promise<void> {
    const now = new Date();

    await this.repository.update(this.id, { priceMargin: marginPercentage, updatedAt: now });

    this.price.setMargin(marginPercentage);
    this.updatedAt = now;
  }

  // --- Stock ---

  async receiveStock(quantity: number): Promise<void> {
    if (this.status === "deprecated") throw new ProductStatusError("Cannot restock a deprecated product");

    const newStock = this.stock + quantity;
    const newQuantity = this.quantity + quantity;
    const newStatus =
      this.status === "out_of_stock" && newStock > 0 ? this.checkTransition("active") : this.status;
    const now = new Date();

    console.log(
      `Restocking ${this.name} at ${
        this.warehouse ? this.warehouse.getRestockingLocation() : "no warehouse"
      }`,
    );
    await this.repository.update(this.id, { stock: newStock, quantity: newQuantity, status: newStatus, updatedAt: now });

    this.stock = newStock;
    this.quantity = newQuantity;
    this.status = newStatus;
    this.updatedAt = now;
  }

  async sell(quantity: number): Promise<void> {
    if (this.status === "deprecated") throw new ProductStatusError("Cannot sell a deprecated product");
    if (this.stock < quantity) throw new InsufficientStockError("Not enough stock");

    const newStock = this.stock - quantity;
    const newStatus = newStock === 0 ? this.checkTransition("out_of_stock") : this.status;
    const now = new Date();

    await this.repository.update(this.id, { stock: newStock, status: newStatus, updatedAt: now });

    this.stock = newStock;
    this.status = newStatus;
    this.updatedAt = now;

    this.notifications.push(
      ...notificationService.productSold(this.id, this.name, quantity, this.stock, [...this.suppliersRegions.values()]),
    );
  }

  // --- Lifecycle ---

  async deprecate(): Promise<void> {
    const newStatus = this.checkTransition("deprecated");
    const now = new Date();

    await this.repository.update(this.id, { status: newStatus, stock: 0, updatedAt: now });

    this.status = newStatus;
    this.stock = 0;
    this.updatedAt = now;

    this.notifications.push(
      ...notificationService.productDeprecated(this.id, this.name, [...this.suppliersRegions.values()]),
    );
  }

  async flushNotifications(): Promise<void> {
    if (this.notifications.length === 0) return;

    await this.repository.saveNotifications(this.notifications);

    this.notifications = [];
  }

  // Checks a status transition without applying it: forbidden transitions throw.
  private checkTransition(next: ProductStatus): ProductStatus {
    if (!ALLOWED_TRANSITIONS[this.status].includes(next)) {
      throw new ProductStatusError(`Cannot go from ${this.status} to ${next}`);
    }
    return next;
  }
}
