'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { AdminShell } from '@/components/admin/admin-shell';
import { FormError } from '@/components/form-error';
import { LoadingState } from '@/components/portal/loading-state';
import { useRequireAdminAuth } from '@/hooks/use-require-admin-auth';
import {
  createChecklistTemplate,
  listChecklistTemplates,
  replaceChecklistTemplateItems,
  setChecklistTemplateActive,
} from '@/lib/api';
import { getLocalizedApiMessage, isApiClientError } from '@/lib/api-error';
import type { ChecklistTemplate } from '@/types/logistics';

const DOC_CATEGORIES = [
  'commercial_invoice', 'packing_list', 'bill_of_lading', 'certificate_of_origin',
  'delivery_order', 'customs_declaration', 'insurance_certificate', 'other',
] as const;

export function AdminChecklistTemplatesContent() {
  const t = useTranslations('logistics');
  const locale = useLocale() as 'en' | 'ar';
  const { user, isReady } = useRequireAdminAuth();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = () => {
    if (!user) return;
    setIsLoading(true);
    void listChecklistTemplates()
      .then((items) => { setTemplates(items); setError(null); })
      .catch((err) => setError(isApiClientError(err) ? getLocalizedApiMessage(err, locale) : t('errors.generic')))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (!isReady || !user) return;
    reload();
  }, [isReady, user]);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    await createChecklistTemplate({
      nameEn: form.get('nameEn'),
      nameAr: form.get('nameAr'),
      transactionType: form.get('transactionType') || undefined,
      serviceType: form.get('serviceType') || undefined,
      cargoType: form.get('cargoType') || undefined,
      isActive: true,
      items: [{ documentCategory: 'commercial_invoice', required: true }, { documentCategory: 'packing_list', required: true }],
    });
    e.currentTarget.reset();
    reload();
  }

  if (!isReady || !user) return <LoadingState message={t('loading')} />;

  return (
    <AdminShell user={user} title={t('checklistTemplates.title')}>
      {error ? <FormError message={error} /> : null}
      {isLoading ? <LoadingState message={t('loading')} /> : (
        <>
          <form className="logistics-form" onSubmit={(e) => void handleCreate(e)}>
            <h2>{t('checklistTemplates.create')}</h2>
            <input name="nameEn" placeholder={t('checklistTemplates.nameEn')} required />
            <input name="nameAr" placeholder={t('checklistTemplates.nameAr')} required dir="rtl" />
            <select name="transactionType" defaultValue="">
              <option value="">{t('checklistTemplates.anyTransaction')}</option>
              {['import', 'export', 'transit', 're_export', 'temporary_import', 'temporary_export', 'free_zone'].map((type) => (
                <option key={type} value={type}>{t(`customs.transactionTypes.${type}` as never)}</option>
              ))}
            </select>
            <input name="serviceType" placeholder={t('checklistTemplates.serviceType')} />
            <input name="cargoType" placeholder={t('checklistTemplates.cargoType')} />
            <button type="submit" className="rental-btn rental-btn--primary">{t('checklistTemplates.save')}</button>
          </form>

          <div className="logistics-table" style={{ marginTop: '2rem' }}>
            {templates.map((template) => (
              <div key={template.id} className="logistics-panel">
                <header className="logistics-page__header">
                  <div>
                    <strong>{locale === 'ar' ? template.nameAr : template.nameEn}</strong>
                    <span className="logistics-badge">{template.isActive ? t('checklistTemplates.active') : t('checklistTemplates.inactive')}</span>
                  </div>
                  <div className="logistics-hero__actions">
                    <button type="button" className="rental-btn rental-btn--ghost" onClick={() => void setChecklistTemplateActive(template.id, !template.isActive).then(reload)}>
                      {template.isActive ? t('checklistTemplates.deactivate') : t('checklistTemplates.activate')}
                    </button>
                    <button type="button" className="rental-btn rental-btn--ghost" onClick={() => setEditingId(editingId === template.id ? null : template.id)}>
                      {t('checklistTemplates.editItems')}
                    </button>
                  </div>
                </header>
                <p>{template.transactionType ? t(`customs.transactionTypes.${template.transactionType}` as never) : t('checklistTemplates.anyTransaction')}</p>
                {template.serviceType ? <p>{t('checklistTemplates.serviceType')}: {template.serviceType}</p> : null}
                {template.cargoType ? <p>{t('checklistTemplates.cargoType')}: {template.cargoType}</p> : null}
                <ul>
                  {(template.items ?? []).map((item) => (
                    <li key={item.id}>
                      {item.documentCategory.replace(/_/g, ' ')}
                      {' — '}
                      {item.required ? t('checklistTemplates.required') : t('checklistTemplates.optional')}
                    </li>
                  ))}
                </ul>
                {editingId === template.id ? (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const selected = DOC_CATEGORIES.filter((cat) => form.get(cat) === 'on');
                    void replaceChecklistTemplateItems(
                      template.id,
                      selected.map((cat, index) => ({
                        documentCategory: cat,
                        required: form.get(`${cat}_required`) === 'on',
                        sortOrder: index,
                      })),
                    ).then(() => { setEditingId(null); reload(); });
                  }}>
                    {DOC_CATEGORIES.map((cat) => {
                      const existing = template.items?.find((i) => i.documentCategory === cat);
                      return (
                        <label key={cat} className="logistics-form__checkbox">
                          <input name={cat} type="checkbox" defaultChecked={!!existing} />
                          {cat.replace(/_/g, ' ')}
                          <input name={`${cat}_required`} type="checkbox" defaultChecked={existing?.required ?? true} />
                          {t('checklistTemplates.required')}
                        </label>
                      );
                    })}
                    <button type="submit" className="rental-btn rental-btn--primary">{t('checklistTemplates.saveItems')}</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </AdminShell>
  );
}
