import type {
  DashboardOrder,
  DashboardOrderPart,
  DashboardShopOffer,
  DashboardVehicle
} from "../types/dashboard";

export function mapOrderRowToDashboardOrder(row: any, vehicleRow?: any | null): DashboardOrder {
  console.log("[DashboardMapper] mapOrderRowToDashboardOrder input row:", {
    id: row?.id,
    hasVehicle: !!vehicleRow
  });

  const orderData = (row?.order_data || {}) as any;

  const part: DashboardOrderPart | null = {
    partCategory: orderData.partCategory ?? null,
    position: orderData.position ?? null,
    partText: orderData.partText ?? orderData.partDescription ?? null,
    partDetails: orderData.partDetails ?? null,
    oemStatus: orderData.oemStatus ?? null,
    oemNumber: row.oem_number ?? orderData.oemNumber ?? null
  };

  const vehicle: DashboardVehicle | null =
    vehicleRow && typeof vehicleRow === "object"
      ? {
        vin: vehicleRow.vin ?? null,
        hsn: vehicleRow.hsn ?? null,
        tsn: vehicleRow.tsn ?? null,
        make: vehicleRow.make ?? null,
        model: vehicleRow.model ?? null,
        year: vehicleRow.year != null ? Number(vehicleRow.year) : null,
        engine: vehicleRow.engine ?? vehicleRow.engine_code ?? null
      }
      : null;

  const mapped: DashboardOrder = {
    id: row.id,
    status: row.status,
    language: row.language ?? orderData.language ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    customerId: row.customer_id ?? null,
    customerPhone: row.customer_phone ?? row.customer_contact ?? null,
    vehicle,
    part,
    oem_number: row.oem_number ?? null
  };

  console.log("[DashboardMapper] mapped order", { id: mapped.id, status: mapped.status });
  return mapped;
}

export function mapOfferRowToDashboardShopOffer(row: any): DashboardShopOffer {
  const mapped: DashboardShopOffer = {
    id: row.id,
    orderId: row.order_id ?? row.orderId,
    shopName: row.shopName ?? row.shop_name ?? "",
    brand: row.brand ?? row.shop_name ?? "",
    productName: row.productName ?? row.product_name ?? row.shop_name ?? "",
    oemNumber: row.oemNumber ?? row.oem_number ?? row.oem ?? null,
    basePrice: Number(row.price ?? row.base_price ?? row.basePrice ?? 0),
    marginPercent:
      row.margin_percent !== null && row.margin_percent !== undefined
        ? Number(row.margin_percent)
        : null,
    status: row.status ?? "draft",
    tier: row.tier ?? null
  };

  console.log("[DashboardMapper] mapped offer", { id: mapped.id, orderId: mapped.orderId });
  return mapped;
}
