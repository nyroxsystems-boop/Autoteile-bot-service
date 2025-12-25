export type DashboardOrderPart = {
  partCategory?: string | null;
  position?: string | null;
  partText?: string | null;
  partDetails?: Record<string, any> | null;
  oemStatus?: "pending" | "success" | "not_found" | "multiple_matches" | null;
  oemNumber?: string | null;
};

export type DashboardVehicle = {
  vin?: string | null;
  hsn?: string | null;
  tsn?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  engine?: string | null;
};

export type DashboardOrder = {
  id: string;
  status: string;
  language: string | null;
  createdAt: string;
  updatedAt: string;
  created_at?: string; // Alias for database compatibility
  updated_at?: string; // Alias for database compatibility
  customerId?: string | null;
  customerPhone?: string | null;
  vehicle: DashboardVehicle | null;
  part: DashboardOrderPart | null;
  oem_number?: string | null; // Direct OEM number from database
};

export type DashboardShopOffer = {
  id: string;
  orderId: string;
  shopName?: string;
  brand: string;
  productName: string;
  oemNumber: string | null;
  basePrice: number;
  marginPercent: number | null;
  status: "draft" | "published";
  tier: "cheap" | "medium" | "expensive" | null;
};

export type DashboardStatsRange = "today" | "week" | "month";

export type DashboardStats = {
  range: DashboardStatsRange;
  totalOrders: number;
  openOemIssues: number;
  inboundMessages: number;
  abortedOrders: number;
  completedOrders: number;
};
