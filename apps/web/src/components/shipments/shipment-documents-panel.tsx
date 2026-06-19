'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { FormError } from '../form-error';

import { listShipmentDocuments, uploadShipmentDocument } from '@/lib/api';
import { buildAssetUrl } from '@/lib/api-config';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { ShipmentDocument } from '@/types/shipment';

type ShipmentDocumentsPanelProps = {
  shipmentId: string;
  canUpload: boolean;
};

export function ShipmentDocumentsPanel({ shipmentId, canUpload }: ShipmentDocumentsPanelProps) {
  const t = useTranslations('shipments.documents');
  const locale = useLocale();
  const [documents, setDocuments] = useState<ShipmentDocument[]>([]);
  const [documentType, setDocumentType] = useState('customs');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    void listShipmentDocuments(shipmentId)
      .then(setDocuments)
      .catch(() => setDocuments([]));
  }, [shipmentId]);

  return (
    <section className="panel">
      <h2 className="panel__title">{t('title')}</h2>
      <p className="muted-text">{t('subtitle')}</p>
      <FormError message={error} />

      {canUpload ? (
        <div className="form-actions" style={{ marginBottom: '1rem', gap: '0.75rem' }}>
          <select
            value={documentType}
            onChange={(event) => setDocumentType(event.target.value)}
            style={{ padding: '0.5rem', borderRadius: '0.5rem' }}
          >
            <option value="customs">{t('types.customs')}</option>
            <option value="bill_of_lading">{t('types.billOfLading')}</option>
            <option value="commercial_invoice">{t('types.commercialInvoice')}</option>
            <option value="packing_list">{t('types.packingList')}</option>
            <option value="other">{t('types.other')}</option>
          </select>
          <label className="portal-button portal-button--ghost" style={{ cursor: 'pointer' }}>
            {isUploading ? t('uploading') : t('upload')}
            <input
              type="file"
              accept=".pdf,image/*"
              hidden
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) {
                  return;
                }

                setError(null);
                setIsUploading(true);
                try {
                  const uploaded = await uploadShipmentDocument(shipmentId, file, documentType);
                  setDocuments((current) => [uploaded, ...current]);
                } catch (uploadError) {
                  setError(
                    isApiClientError(uploadError)
                      ? getLocalizedApiMessage(uploadError, locale as 'en' | 'ar')
                      : t('errors.generic'),
                  );
                } finally {
                  setIsUploading(false);
                  event.target.value = '';
                }
              }}
            />
          </label>
        </div>
      ) : null}

      {documents.length === 0 ? (
        <p className="muted-text">{t('empty')}</p>
      ) : (
        <ul className="timeline-list">
          {documents.map((document) => (
            <li key={document.id}>
              <a
                href={buildAssetUrl(document.fileUrl)}
                target="_blank"
                rel="noreferrer"
              >
                {document.documentType} — {new Date(document.uploadedAt).toLocaleString(locale)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
