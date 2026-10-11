import { PrismaClient, Prisma } from "@prisma/client";
import { Supplier, type Notification, type ProductChanges, type ProductRepository } from "./Product";

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  async update(productId: string, changes: ProductChanges): Promise<void> {
    await this.prisma.product.update({
      where: { id: productId },
      data: { ...changes, images: changes.images as Prisma.InputJsonValue | undefined },
    });
  }

  async saveSupplier(productId: string, region: string, supplierId: string): Promise<void> {
    await this.prisma.productSupplier.upsert({
      where: { productId_region: { productId, region } },
      create: { productId, region, supplierId },
      update: { supplierId },
    });
  }

  async findSuppliers(productId: string): Promise<Map<string, Supplier>> {
    const rows = await this.prisma.productSupplier.findMany({
      where: { productId },
      include: { supplier: true },
    });

    const suppliers = new Map<string, Supplier>();
    for (const row of rows) {
      const { id, name, email, region } = row.supplier;
      suppliers.set(row.region, new Supplier(id, name, email, region));
    }
    return suppliers;
  }

  async saveNotifications(notifications: Notification[]): Promise<void> {
    await this.prisma.notification.createMany({ data: notifications });
  }
}
