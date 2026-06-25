import { buildApiUrl } from '@/lib/api-config';
import {
  createNetworkError,
  createUnauthorizedError,
  isApiClientError,
  parseApiError,
} from '@/lib/api-error';
import {
  clearAuthSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  storeAuthSession,
} from '@/lib/auth-storage';
import type {
  AdminCustomer,
  AdminDashboardMetrics,
  AssignShipmentInput,
  FleetDriverOption,
  FleetOwnerOption,
  FleetVehicleOption,
  PaginatedAdminRatings,
  PaginatedPayments,
  UpdateShipmentStatusInput,
} from '@/types/admin';
import type { AuthTokensResponse, LoginRequest, RegisterRequest } from '@/types/auth';
import type { AcceptShipmentInput } from '@/types/fleet';
import type { GeoRegion, GovernorateWithWilayats } from '@/types/geography';
import type {
  CreateQuoteRequestInput,
  CreateTruckListingInput,
  FleetTruckListing,
  MarketplaceAdminMetrics,
  MarketplaceBrowseQuery,
  MarketplaceHomeSections,
  PaginatedTruckListings,
  TruckListingDetail,
  TruckListingSummary,
  TruckQuoteRequest,
  UpdateTruckListingInput,
} from '@/types/marketplace';
import type {
  NotificationListQuery,
  PaginatedNotifications,
  UnreadNotificationsCount,
} from '@/types/notification';
import type {
  ConfirmPaymentInput,
  ConfirmPaymentResponse,
  PaymentIntent,
  PaymentQuote,
} from '@/types/payment';
import type { FleetRatingSummary, PaginatedPayouts, PayoutRequest, PayoutSummary } from '@/types/payout';
import type { PlatformSettings, UpdateSettingsInput } from '@/types/settings';
import type {
  CarrierRating,
  CreateShipmentRequest,
  PaginatedShipments,
  Shipment,
  ShipmentContract,
  ShipmentDocument,
  ShipmentInvoice,
  ShipmentListQuery,
  ShipmentTimeline,
  UpdateShipmentRequest,
} from '@/types/shipment';
import type {
  CreateShipmentRequestInput,
  ShipmentRequestRecord,
} from '@/types/shipment-request';
import type { PublicTracking } from '@/types/tracking';
import type { PaginatedWalletTransactions, Wallet } from '@/types/wallet';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    const headers = new Headers(init?.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    response = await fetch(buildApiUrl(path), {
      ...init,
      headers,
    });
  } catch {
    throw createNetworkError();
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

let ongoingRefresh: Promise<string | null> | null = null;

async function refreshAuthSession(force = false): Promise<string | null> {
  if (!force) {
    const existingToken = getAccessToken();
    if (existingToken) {
      return existingToken;
    }
  }

  const refreshToken = getRefreshToken();
  const user = getStoredUser();

  if (!refreshToken || !user) {
    clearAuthSession();
    return null;
  }

  if (!ongoingRefresh) {
    ongoingRefresh = (async () => {
      try {
        const result = await request<AuthTokensResponse>('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
        storeAuthSession(result);
        return result.accessToken;
      } catch {
        clearAuthSession();
        return null;
      } finally {
        ongoingRefresh = null;
      }
    })();
  }

  return ongoingRefresh;
}

async function authRequest<T>(path: string, init?: RequestInit, allowRefresh = true): Promise<T> {
  let token = getAccessToken();

  if (!token && allowRefresh) {
    token = await refreshAuthSession();
  }

  if (!token) {
    throw createUnauthorizedError();
  }

  try {
    return await request<T>(path, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        Authorization: `Bearer ${token}`,
      },
    });
  } catch (error) {
    if (allowRefresh && isApiClientError(error) && error.code === 'UNAUTHORIZED') {
      const refreshed = await refreshAuthSession(true);
      if (refreshed) {
        return authRequest<T>(path, init, false);
      }
    }

    throw error;
  }
}

function toQueryString(query?: ShipmentListQuery): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();

  if (query.status) {
    params.set('status', query.status);
  }

  if (query.page) {
    params.set('page', String(query.page));
  }

  if (query.limit) {
    params.set('limit', String(query.limit));
  }

  if (query.search) {
    params.set('search', query.search);
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function login(input: LoginRequest): Promise<AuthTokensResponse> {
  return request<AuthTokensResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function register(input: RegisterRequest): Promise<AuthTokensResponse> {
  return request<AuthTokensResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listShipments(query?: ShipmentListQuery): Promise<PaginatedShipments> {
  return authRequest<PaginatedShipments>(`/shipments${toQueryString(query)}`);
}

export async function getShipment(id: string): Promise<Shipment> {
  return authRequest<Shipment>(`/shipments/${id}`);
}

export async function createShipment(input: CreateShipmentRequest): Promise<Shipment> {
  return authRequest<Shipment>('/shipments', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateShipment(id: string, input: UpdateShipmentRequest): Promise<Shipment> {
  return authRequest<Shipment>(`/shipments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

async function downloadAuthBlob(path: string): Promise<Blob> {
  const token = getAccessToken();
  if (!token) {
    throw createUnauthorizedError();
  }

  const response = await fetch(buildApiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.blob();
}

export async function downloadShipmentContractPdf(shipmentId: string): Promise<Blob> {
  return downloadAuthBlob(`/shipments/${shipmentId}/contract/pdf`);
}

export async function downloadShipmentInvoicePdf(shipmentId: string): Promise<Blob> {
  return downloadAuthBlob(`/shipments/${shipmentId}/invoice/pdf`);
}

export async function getShipmentPaymentQuote(shipmentId: string): Promise<PaymentQuote> {
  return authRequest<PaymentQuote>(`/shipments/${shipmentId}/payment-quote`);
}

export async function createShipmentPaymentIntent(
  shipmentId: string,
  locale?: string,
): Promise<PaymentIntent> {
  return authRequest<PaymentIntent>(`/shipments/${shipmentId}/payment-intent`, {
    method: 'POST',
    body: JSON.stringify(locale ? { locale } : {}),
  });
}

export async function confirmCardPayment(
  paymentIntentId: string,
  input: ConfirmPaymentInput,
): Promise<ConfirmPaymentResponse> {
  return authRequest<ConfirmPaymentResponse>(`/payments/intents/${paymentIntentId}/confirm`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function verifyShipmentPayment(shipmentId: string): Promise<ConfirmPaymentResponse> {
  return authRequest<ConfirmPaymentResponse>(`/shipments/${shipmentId}/payment/verify`, {
    method: 'POST',
  });
}

export async function exportAdminShipmentsCsv(query?: ShipmentListQuery): Promise<Blob> {
  const token = getAccessToken();
  if (!token) {
    throw createUnauthorizedError();
  }

  const response = await fetch(buildApiUrl(`/admin/shipments/export/csv${toQueryString(query)}`), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.blob();
}

export async function exportAdminShipmentsPdf(query?: ShipmentListQuery): Promise<Blob> {
  const token = getAccessToken();
  if (!token) {
    throw createUnauthorizedError();
  }

  const response = await fetch(buildApiUrl(`/admin/shipments/export/pdf${toQueryString(query)}`), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.blob();
}

/** @deprecated Use card payment flow instead */
export async function confirmShipment(id: string): Promise<Shipment> {
  return authRequest<Shipment>(`/shipments/${id}/confirm`, {
    method: 'POST',
  });
}

export async function cancelShipment(id: string): Promise<Shipment> {
  return authRequest<Shipment>(`/shipments/${id}/cancel`, {
    method: 'POST',
  });
}

export async function completeShipment(id: string): Promise<Shipment> {
  return authRequest<Shipment>(`/shipments/${id}/complete`, {
    method: 'POST',
  });
}

export async function listShipmentDocuments(shipmentId: string): Promise<ShipmentDocument[]> {
  return authRequest<ShipmentDocument[]>(`/shipments/${shipmentId}/documents`);
}

export async function uploadShipmentDocument(
  shipmentId: string,
  file: File,
  documentType?: string,
): Promise<ShipmentDocument> {
  const token = getAccessToken();
  if (!token) {
    throw createUnauthorizedError();
  }

  const formData = new FormData();
  formData.append('file', file);
  if (documentType) {
    formData.append('documentType', documentType);
  }

  const response = await fetch(buildApiUrl(`/shipments/${shipmentId}/documents`), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw await parseApiError(response);
  }

  return response.json() as Promise<ShipmentDocument>;
}

export async function getShipmentContract(shipmentId: string): Promise<ShipmentContract> {
  return authRequest<ShipmentContract>(`/shipments/${shipmentId}/contract`);
}

export async function getShipmentInvoice(shipmentId: string): Promise<ShipmentInvoice> {
  return authRequest<ShipmentInvoice>(`/shipments/${shipmentId}/invoice`);
}

export async function submitShipmentRating(
  shipmentId: string,
  input: { score: number; comment?: string },
): Promise<CarrierRating> {
  return authRequest<CarrierRating>(`/shipments/${shipmentId}/rating`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getShipmentRating(shipmentId: string): Promise<CarrierRating | null> {
  return authRequest<CarrierRating | null>(`/shipments/${shipmentId}/rating`);
}

export async function createFleetDriver(input: {
  email: string;
  password: string;
  licenseNumber: string;
  phone?: string;
}): Promise<FleetDriverOption> {
  return authRequest<FleetDriverOption>('/fleet/drivers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function createFleetVehicle(input: {
  plateNumber: string;
  vehicleType: string;
  capacityKg?: number;
}): Promise<FleetVehicleOption> {
  return authRequest<FleetVehicleOption>('/fleet/vehicles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function recordDriverTrackingPoint(
  shipmentId: string,
  input: { latitude: number; longitude: number; speed?: number },
): Promise<void> {
  return authRequest<void>(`/driver/shipments/${shipmentId}/tracking`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getShipmentLiveTracking(shipmentId: string): Promise<{
  latitude: number;
  longitude: number;
  speed: number | null;
  recordedAt: string;
} | null> {
  return authRequest(`/shipments/${shipmentId}/tracking/live`);
}

export async function getShipmentTimeline(id: string): Promise<ShipmentTimeline> {
  return authRequest<ShipmentTimeline>(`/shipments/${id}/timeline`);
}

export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  return authRequest<AdminDashboardMetrics>('/admin/dashboard/metrics');
}

export async function listFleetOwners(): Promise<FleetOwnerOption[]> {
  return authRequest<FleetOwnerOption[]>('/admin/fleet-owners');
}

export async function listAdminCustomers(): Promise<AdminCustomer[]> {
  return authRequest<AdminCustomer[]>('/admin/customers');
}

export async function listAdminRatings(page = 1, limit = 20): Promise<PaginatedAdminRatings> {
  return authRequest<PaginatedAdminRatings>(`/admin/ratings?page=${page}&limit=${limit}`);
}

export async function listPaymentHistory(page = 1, limit = 20): Promise<PaginatedPayments> {
  return authRequest<PaginatedPayments>(`/payments/history?page=${page}&limit=${limit}`);
}

export async function listFleetDrivers(): Promise<FleetDriverOption[]> {
  return authRequest<FleetDriverOption[]>('/fleet/drivers');
}

export async function listFleetVehicles(): Promise<FleetVehicleOption[]> {
  return authRequest<FleetVehicleOption[]>('/fleet/vehicles');
}

export async function adminAssignShipment(
  shipmentId: string,
  input: AssignShipmentInput,
): Promise<Shipment> {
  return authRequest<Shipment>(`/admin/shipments/${shipmentId}/assign`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function adminUpdateShipmentStatus(
  shipmentId: string,
  input: UpdateShipmentStatusInput,
): Promise<Shipment> {
  return authRequest<Shipment>(`/admin/shipments/${shipmentId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function listAvailableFleetShipments(
  query?: ShipmentListQuery,
): Promise<PaginatedShipments> {
  return authRequest<PaginatedShipments>(`/fleet/shipments/available${toQueryString(query)}`);
}

export async function acceptFleetShipment(
  shipmentId: string,
  input: AcceptShipmentInput,
): Promise<Shipment> {
  return authRequest<Shipment>(`/fleet/shipments/${shipmentId}/accept`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getMyWallet(): Promise<Wallet> {
  return authRequest<Wallet>('/wallets/me');
}

export async function getMyWalletTransactions(page = 1, limit = 20): Promise<PaginatedWalletTransactions> {
  return authRequest<PaginatedWalletTransactions>(`/wallets/me/transactions?page=${page}&limit=${limit}`);
}

export async function getFleetPayoutSummary(): Promise<PayoutSummary> {
  return authRequest<PayoutSummary>('/payouts/summary');
}

export async function listFleetPayouts(page = 1, limit = 20): Promise<PaginatedPayouts> {
  return authRequest<PaginatedPayouts>(`/payouts?page=${page}&limit=${limit}`);
}

export async function createFleetPayout(input: {
  amount: number;
  bankDetails: { accountName: string; bankName: string; iban: string };
}): Promise<PayoutRequest> {
  return authRequest<PayoutRequest>('/payouts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getAdminPayoutSummary(): Promise<PayoutSummary> {
  return authRequest<PayoutSummary>('/admin/payouts/summary');
}

export async function listAdminPayouts(page = 1, limit = 20): Promise<PaginatedPayouts> {
  return authRequest<PaginatedPayouts>(`/admin/payouts?page=${page}&limit=${limit}`);
}

export async function approveAdminPayout(id: string): Promise<PayoutRequest> {
  return authRequest<PayoutRequest>(`/admin/payouts/${id}/approve`, { method: 'PATCH' });
}

export async function rejectAdminPayout(id: string, reason: string): Promise<PayoutRequest> {
  return authRequest<PayoutRequest>(`/admin/payouts/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}

export async function markAdminPayoutPaid(id: string): Promise<PayoutRequest> {
  return authRequest<PayoutRequest>(`/admin/payouts/${id}/mark-paid`, { method: 'PATCH' });
}

export async function getFleetRatingsSummary(): Promise<FleetRatingSummary> {
  return authRequest<FleetRatingSummary>('/fleet/ratings');
}

export async function updateFleetDriver(
  id: string,
  input: { licenseNumber?: string; phone?: string; isAvailable?: boolean },
): Promise<FleetDriverOption> {
  return authRequest<FleetDriverOption>(`/fleet/drivers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteFleetDriver(id: string): Promise<void> {
  return authRequest<void>(`/fleet/drivers/${id}`, { method: 'DELETE' });
}

export async function updateFleetVehicle(
  id: string,
  input: { plateNumber?: string; vehicleType?: string; capacityKg?: number; isActive?: boolean },
): Promise<FleetVehicleOption> {
  return authRequest<FleetVehicleOption>(`/fleet/vehicles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteFleetVehicle(id: string): Promise<void> {
  return authRequest<void>(`/fleet/vehicles/${id}`, { method: 'DELETE' });
}

export async function getDriverActiveShipment(): Promise<Shipment | null> {
  return authRequest<Shipment | null>('/driver/shipments/active');
}

export async function driverPickup(shipmentId: string): Promise<Shipment> {
  return authRequest<Shipment>(`/driver/shipments/${shipmentId}/pickup`, {
    method: 'POST',
  });
}

export async function driverStartTransit(shipmentId: string): Promise<Shipment> {
  return authRequest<Shipment>(`/driver/shipments/${shipmentId}/start-transit`, {
    method: 'POST',
  });
}

export async function driverDeliver(shipmentId: string): Promise<Shipment> {
  return authRequest<Shipment>(`/driver/shipments/${shipmentId}/deliver`, {
    method: 'POST',
  });
}

function toNotificationQueryString(query?: NotificationListQuery): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();

  if (query.page) {
    params.set('page', String(query.page));
  }

  if (query.limit) {
    params.set('limit', String(query.limit));
  }

  if (query.unreadOnly) {
    params.set('unreadOnly', 'true');
  }

  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function listNotifications(
  query?: NotificationListQuery,
): Promise<PaginatedNotifications> {
  return authRequest<PaginatedNotifications>(`/notifications${toNotificationQueryString(query)}`);
}

export async function getUnreadNotificationsCount(): Promise<UnreadNotificationsCount> {
  return authRequest<UnreadNotificationsCount>('/notifications/unread-count');
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
  return authRequest<void>(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsAsRead(): Promise<{ updatedCount: number }> {
  return authRequest<{ updatedCount: number }>('/notifications/read-all', {
    method: 'POST',
  });
}

export async function getPublicTracking(referenceNumber: string): Promise<PublicTracking> {
  return request<PublicTracking>(`/public/track/${encodeURIComponent(referenceNumber)}`);
}

export async function getSettings(): Promise<PlatformSettings> {
  return authRequest<PlatformSettings>('/settings');
}

export async function updateSettings(input: UpdateSettingsInput): Promise<void> {
  return authRequest<void>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

function toMarketplaceQueryString(query?: MarketplaceBrowseQuery): string {
  if (!query) return '';
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export async function browseMarketplaceTrucks(
  query?: MarketplaceBrowseQuery,
): Promise<PaginatedTruckListings> {
  return request<PaginatedTruckListings>(
    `/marketplace/trucks${toMarketplaceQueryString(query)}`,
  );
}

export async function getMarketplaceHome(): Promise<MarketplaceHomeSections> {
  return request<MarketplaceHomeSections>('/marketplace/home');
}

export async function getMarketplaceTruck(slug: string): Promise<TruckListingDetail> {
  return request<TruckListingDetail>(`/marketplace/trucks/${encodeURIComponent(slug)}`);
}

export async function getSimilarTrucks(slug: string): Promise<TruckListingSummary[]> {
  return request<TruckListingSummary[]>(
    `/marketplace/trucks/${encodeURIComponent(slug)}/similar`,
  );
}

export async function listFleetQuoteRequests(): Promise<TruckQuoteRequest[]> {
  return authRequest<TruckQuoteRequest[]>('/marketplace/quotes/fleet');
}

export async function listFleetTruckListings(): Promise<FleetTruckListing[]> {
  return authRequest<FleetTruckListing[]>('/fleet/marketplace/trucks');
}

export async function getFleetTruckListing(id: string): Promise<FleetTruckListing> {
  return authRequest<FleetTruckListing>(`/fleet/marketplace/trucks/${id}`);
}

export async function createFleetTruckListing(
  input: CreateTruckListingInput,
): Promise<FleetTruckListing> {
  return authRequest<FleetTruckListing>('/fleet/marketplace/trucks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateFleetTruckListing(
  id: string,
  input: UpdateTruckListingInput,
): Promise<FleetTruckListing> {
  return authRequest<FleetTruckListing>(`/fleet/marketplace/trucks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function submitFleetTruckListing(id: string): Promise<FleetTruckListing> {
  return authRequest<FleetTruckListing>(`/fleet/marketplace/trucks/${id}/submit`, {
    method: 'POST',
  });
}

export async function requestTruckQuote(
  listingId: string,
  input: CreateQuoteRequestInput,
): Promise<TruckQuoteRequest> {
  return authRequest<TruckQuoteRequest>(`/marketplace/trucks/${listingId}/quotes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getAdminMarketplaceMetrics(): Promise<MarketplaceAdminMetrics> {
  return authRequest<MarketplaceAdminMetrics>('/admin/marketplace/metrics');
}

export async function listAdminMarketplaceTrucks(
  status?: string,
): Promise<FleetTruckListing[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return authRequest<FleetTruckListing[]>(`/admin/marketplace/trucks${query}`);
}

export async function approveAdminMarketplaceTruck(id: string): Promise<FleetTruckListing> {
  return authRequest<FleetTruckListing>(`/admin/marketplace/trucks/${id}/approve`, {
    method: 'POST',
  });
}

export async function rejectAdminMarketplaceTruck(
  id: string,
  rejectionReason: string,
): Promise<FleetTruckListing> {
  return authRequest<FleetTruckListing>(`/admin/marketplace/trucks/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ rejectionReason }),
  });
}

export async function featureAdminMarketplaceTruck(
  id: string,
  isFeatured: boolean,
): Promise<FleetTruckListing> {
  return authRequest<FleetTruckListing>(`/admin/marketplace/trucks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isFeatured }),
  });
}

export async function listGovernorates(countryCode = 'OM'): Promise<GovernorateWithWilayats[]> {
  return request<GovernorateWithWilayats[]>(
    `/geography/countries/${encodeURIComponent(countryCode)}/governorates`,
  );
}

export async function searchGeoRegions(countryCode: string, q: string): Promise<GeoRegion[]> {
  const params = new URLSearchParams({ q });
  return request<GeoRegion[]>(
    `/geography/countries/${encodeURIComponent(countryCode)}/search?${params}`,
  );
}

export async function getGeoRegion(id: string): Promise<GeoRegion> {
  return request<GeoRegion>(`/geography/regions/${encodeURIComponent(id)}`);
}

export async function createShipmentRequest(
  input: CreateShipmentRequestInput,
): Promise<ShipmentRequestRecord> {
  return authRequest<ShipmentRequestRecord>('/shipment-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listMyShipmentRequests(): Promise<ShipmentRequestRecord[]> {
  return authRequest<ShipmentRequestRecord[]>('/shipment-requests/mine');
}

export async function listFleetShipmentRequests(): Promise<ShipmentRequestRecord[]> {
  return authRequest<ShipmentRequestRecord[]>('/shipment-requests/fleet');
}

export { ApiClientError } from '@/lib/api-error';
