export type CustomsClearanceRequest = {
  id: string;
  referenceNumber: string;
  logisticsOrderId?: string | null;
  transactionType: string;
  status: string;
  shipmentReference?: string | null;
  customerReference?: string | null;
  billOfLadingNumber?: string | null;
  bookingNumber?: string | null;
  shippingLine?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
  portOfLoading?: string | null;
  portOfDischarge?: string | null;
  finalDestination?: string | null;
  countryOfOrigin?: string | null;
  destinationCountry?: string | null;
  eta?: string | null;
  etd?: string | null;
  declarationNumber?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  cargoLines?: CustomsCargoLine[];
  documents?: LogisticsDocument[];
  checklistItems?: DocumentChecklistItem[];
  statusHistory?: StatusHistoryEntry[];
  quotes?: LogisticsQuote[];
  logisticsOrder?: { id: string; referenceNumber: string; title?: string | null };
  _count?: { documents: number; cargoLines: number };
};

export type CustomsCargoLine = {
  id: string;
  description: string;
  hsCode?: string | null;
  packageCount?: number | null;
  grossWeightKg?: string | null;
  cargoValue?: string | null;
  currency: string;
  containerCount?: number | null;
  containerType?: string | null;
};

export type FreightForwardingRequest = {
  id: string;
  referenceNumber: string;
  logisticsOrderId?: string | null;
  transportMode: string;
  serviceType?: string | null;
  routeType: string;
  status: string;
  origin?: string | null;
  destination?: string | null;
  cargoDescription?: string | null;
  commodity?: string | null;
  weightKg?: string | null;
  volumeCbm?: string | null;
  containerType?: string | null;
  containerQuantity?: number | null;
  pickupRequired: boolean;
  deliveryRequired: boolean;
  customsClearanceRequired: boolean;
  insuranceRequired: boolean;
  preferredDepartureDate?: string | null;
  specialInstructions?: string | null;
  createdAt: string;
  updatedAt: string;
  documents?: LogisticsDocument[];
  quotes?: LogisticsQuote[];
  statusHistory?: StatusHistoryEntry[];
  logisticsOrder?: { id: string; referenceNumber: string; title?: string | null };
};

export type LogisticsOrder = {
  id: string;
  referenceNumber: string;
  title?: string | null;
  description?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  customsRequests?: Array<{ id: string; referenceNumber: string; status: string; transactionType: string }>;
  freightRequests?: Array<{ id: string; referenceNumber: string; status: string; transportMode: string }>;
  statusHistory?: StatusHistoryEntry[];
  documents?: LogisticsDocument[];
  quotes?: LogisticsQuote[];
  charges?: LogisticsCharge[];
  containers?: ContainerRecord[];
  vehicleShipments?: VehicleShipmentRecord[];
};

export type LogisticsDocument = {
  id: string;
  category: string;
  documentNumber?: string | null;
  originalName?: string | null;
  status: string;
  expiresAt?: string | null;
  createdAt: string;
};

export type DocumentChecklistItem = {
  id: string;
  documentCategory: string;
  status: string;
};

export type StatusHistoryEntry = {
  id: string;
  status: string;
  note?: string | null;
  createdAt: string;
  actor?: { id: string; email: string; role?: string } | null;
};

export type LogisticsQuote = {
  id: string;
  referenceNumber: string;
  status: string;
  totalAmount: string;
  currency: string;
  lines?: Array<{ id: string; category: string; description: string; amount: string; tax: string }>;
};

export type LogisticsCharge = {
  id: string;
  category: string;
  description: string;
  amount: string;
  currency: string;
  quantity?: number;
  tax?: string;
  source?: string | null;
  paymentStatus: string;
  isCustomerVisible?: boolean;
  isInternal?: boolean;
};

export type ContainerRecord = {
  id: string;
  containerNumber: string;
  currentStatus: string;
  currentLocation?: string | null;
  size?: string | null;
  containerType?: string | null;
  sealNumber?: string | null;
  billOfLadingNumber?: string | null;
  shippingLine?: string | null;
  weightKg?: string | null;
  pickupDate?: string | null;
  returnDate?: string | null;
  emptyReturnLocation?: string | null;
  logisticsOrderId?: string | null;
};

export type VehicleShipmentRecord = {
  id: string;
  vin?: string | null;
  chassisNumber?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  weightKg?: string | null;
  containerNumber?: string | null;
  billOfLadingNumber?: string | null;
  customsStatus?: string | null;
};

export type LogisticsDashboard = {
  counts: {
    orders: number;
    customs: number;
    freight: number;
    shipments: number;
    bookings: number;
    pendingQuotes: number;
  };
  recentOrders: LogisticsOrder[];
};

export type FleetLogisticsDashboard = {
  counts: {
    assignedShipments: number;
    activeBookings: number;
    linkedOrders: number;
  };
  recentShipments: Array<{
    id: string;
    referenceNumber: string;
    status: string;
    cargoDescription?: string | null;
    updatedAt: string;
  }>;
  recentBookings: Array<{
    id: string;
    status: string;
    startDate: string;
    endDate: string;
    truckListing?: { name?: string | null; slug?: string | null };
  }>;
  linkedOrders: Array<{
    id: string;
    referenceNumber: string;
    status: string;
    title?: string | null;
  }>;
};

export type AdminCustomsDashboard = {
  recent: Array<{ id: string; referenceNumber: string; status: string }>;
  awaitingDocs: number;
  statusCounts?: Array<{ status: string; _count: { _all: number } }>;
};

export type LogisticsConversation = {
  id: string;
  customerId: string;
  logisticsOrderId?: string | null;
  customsRequestId?: string | null;
  freightRequestId?: string | null;
  quoteId?: string | null;
  lastMessageAt?: string | null;
};

export type LogisticsMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachmentKey?: string | null;
  attachmentOriginalName?: string | null;
  attachmentMimeType?: string | null;
  readAt?: string | null;
  createdAt: string;
  sender?: { id: string; email: string; role?: string };
};

export type ChecklistTemplate = {
  id: string;
  nameEn: string;
  nameAr: string;
  transactionType?: string | null;
  transportMode?: string | null;
  serviceType?: string | null;
  cargoType?: string | null;
  isActive: boolean;
  items?: Array<{ id: string; documentCategory: string; required: boolean; sortOrder: number }>;
};

export type AdminLogisticsDashboard = {
  kpis: {
    pendingDocuments: number;
    pendingQuotes: number;
    customsInProgress: number;
    releasedCargo: number;
    transportPending: number;
    completedOrders: number;
    activeOrders: number;
    overdueCustoms: number;
  };
  recentOrders: Array<{
    id: string;
    referenceNumber: string;
    status: string;
    title?: string | null;
    customer?: { email: string; customerProfile?: { fullName?: string } };
    customsRequests?: Array<{ id: string; referenceNumber: string; status: string }>;
    freightRequests?: Array<{ id: string; referenceNumber: string; status: string }>;
  }>;
};

export type ChargeTotals = {
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  unpaid: number;
  currency: string;
};

export type VehicleImportPreviewRow = {
  row: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
};
