'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const COPY = {
  en: {
    title: 'Government Services QA',
    services: 'Services',
    pending: 'Pending',
    exportCorrected: 'Export corrected JSON',
    records: 'Records',
    searchPlaceholder: 'Search services or documents…',
    allRecords: 'All records',
    saved: 'Saved',
    edited: 'Edited',
    flagged: 'Flagged',
    serviceName: 'Service name',
    directorate: 'Directorate',
    subDirectorate: 'Sub Directorate',
    requiredDocuments: 'Required documents',
    fees: 'Fees',
    notes: 'Notes',
    save: 'Save',
    databaseReady: 'Database ready',
    saving: 'Saving…',
    savedState: 'Saved',
    loading: 'Connecting to database…',
    databaseIssue: 'Database connection issue',
    empty: 'Nothing matches this search.',
    chooseRecord: 'Select a record to edit.',
    serviceCode: 'Service code',
    ministry: 'Ministry'
  },
  ar: {
    title: 'لوحة تدقيق الخدمات الحكومية',
    services: 'الخدمات',
    pending: 'قيد المراجعة',
    exportCorrected: 'تصدير JSON المصحّح',
    records: 'السجلات',
    searchPlaceholder: 'ابحث في الخدمات أو المستندات…',
    allRecords: 'كل السجلات',
    saved: 'محفوظ',
    edited: 'معدّل',
    flagged: 'يحتاج مراجعة',
    serviceName: 'اسم الخدمة',
    directorate: 'المديرية',
    subDirectorate: 'المديرية الفرعية',
    requiredDocuments: 'المستندات المطلوبة',
    fees: 'الرسوم',
    notes: 'ملاحظات',
    save: 'حفظ',
    databaseReady: 'قاعدة البيانات جاهزة',
    saving: 'جارٍ الحفظ…',
    savedState: 'تم الحفظ',
    loading: 'جارٍ الاتصال بقاعدة البيانات…',
    databaseIssue: 'مشكلة في الاتصال بقاعدة البيانات',
    empty: 'لا توجد نتائج مطابقة.',
    chooseRecord: 'اختر سجلاً للتعديل.',
    serviceCode: 'رمز الخدمة',
    ministry: 'الوزارة'
  }
};

const EDITABLE_FIELDS = [
  { key: 'service_name', labelKey: 'serviceName', type: 'input' },
  { key: 'directorate', labelKey: 'directorate', type: 'input' },
  { key: 'sub_directorate', labelKey: 'subDirectorate', type: 'input' },
  { key: 'required_documents', labelKey: 'requiredDocuments', type: 'textarea' },
  { key: 'fees', labelKey: 'fees', type: 'textarea' },
  { key: 'notes', labelKey: 'notes', type: 'textarea' }
];

const SEARCH_FIELDS = [
  'service_code',
  'ministry',
  'service_name',
  'directorate',
  'sub_directorate',
  'required_documents',
  'fees',
  'notes'
];

function correctedRecord(record) {
  return {
    service_code: record.service_code || '',
    ministry: record.ministry || '',
    service_name: record.service_name || '',
    directorate: record.directorate || '',
    sub_directorate: record.sub_directorate || '',
    required_documents: record.required_documents || '',
    fees: record.fees || '',
    notes: record.notes || ''
  };
}

function normalizeSearch(value) {
  return String(value || '').toLocaleLowerCase();
}

export default function QADashboard() {
  const [language, setLanguage] = useState('ar');
  const [records, setRecords] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [databaseReady, setDatabaseReady] = useState(false);
  const [loadState, setLoadState] = useState('loading');
  const [saveState, setSaveState] = useState('idle');
  const [error, setError] = useState('');
  const saveTimers = useRef({});

  const text = COPY[language];
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  const sidebarPosition = language === 'ar' ? 'right' : 'left';

  useEffect(() => {
    async function loadRecords() {
      try {
        setLoadState('loading');
        const response = await fetch('/api/database');
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || 'Database request failed.');
        }

        setRecords(payload.records || []);
        setDatabaseReady(Boolean(payload.databaseReady));
        setLoadState('ready');
      } catch (loadError) {
        setError(loadError.message);
        setLoadState('error');
        setDatabaseReady(false);
      }
    }

    loadRecords();
  }, []);

  useEffect(() => {
    if (!activeId && records.length > 0) {
      setActiveId(records[0].id);
    }
  }, [activeId, records]);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach((timerId) => clearTimeout(timerId));
    };
  }, []);

  const activeRecord = useMemo(() => {
    return records.find((record) => record.id === activeId) || records[0] || null;
  }, [activeId, records]);

  const pendingCount = useMemo(() => {
    return records.filter((record) => record.status === 'pending').length;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const cleanQuery = normalizeSearch(query.trim());

    return records.filter((record) => {
      const statusMatch = filter === 'all' || record.status === filter;
      const queryMatch = !cleanQuery || SEARCH_FIELDS.some((field) => {
        return normalizeSearch(record[field]).includes(cleanQuery);
      });

      return statusMatch && queryMatch;
    });
  }, [filter, query, records]);

  const filterOptions = [
    { value: 'all', label: text.allRecords },
    { value: 'pending', label: text.pending },
    { value: 'saved', label: text.saved },
    { value: 'edited', label: text.edited },
    { value: 'flagged', label: text.flagged }
  ];

  function mergeRecord(updatedRecord) {
    if (!updatedRecord) return;
    setRecords((currentRecords) => currentRecords.map((record) => (
      record.id === updatedRecord.id ? { ...record, ...updatedRecord } : record
    )));
  }

  function markLocalField(serviceId, field, value) {
    setRecords((currentRecords) => currentRecords.map((record) => {
      if (record.id !== serviceId) return record;
      const nextStatus = record.status === 'flagged' ? 'flagged' : 'edited';
      return { ...record, [field]: value, status: nextStatus };
    }));
  }

  async function postDatabaseAction(body) {
    const response = await fetch('/api/database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Database update failed.');
    }

    return payload;
  }

  async function persistField(serviceId, field, value, timerKey) {
    try {
      const payload = await postDatabaseAction({
        action: 'updateField',
        service_id: serviceId,
        field,
        value
      });
      mergeRecord(payload.record);
      setSaveState('saved');
    } catch (saveError) {
      setError(saveError.message);
      setSaveState('idle');
    } finally {
      delete saveTimers.current[timerKey];
    }
  }

  function handleFieldChange(field, value) {
    if (!activeRecord) return;

    const serviceId = activeRecord.id;
    const timerKey = `${serviceId}:${field}`;

    markLocalField(serviceId, field, value);
    setSaveState('saving');
    setError('');

    if (saveTimers.current[timerKey]) {
      clearTimeout(saveTimers.current[timerKey]);
    }

    saveTimers.current[timerKey] = setTimeout(() => {
      persistField(serviceId, field, value, timerKey);
    }, 650);
  }

  async function flushActiveTimers(record) {
    if (!record) return;

    for (const field of EDITABLE_FIELDS) {
      const timerKey = `${record.id}:${field.key}`;
      if (saveTimers.current[timerKey]) {
        clearTimeout(saveTimers.current[timerKey]);
        delete saveTimers.current[timerKey];
      }

      await postDatabaseAction({
        action: 'updateField',
        service_id: record.id,
        field: field.key,
        value: record[field.key] || ''
      });
    }
  }

  async function handleSave() {
    if (!activeRecord) return;

    try {
      setSaveState('saving');
      setError('');
      await flushActiveTimers(activeRecord);
      const payload = await postDatabaseAction({
        action: 'saveRecord',
        service_id: activeRecord.id
      });
      mergeRecord(payload.record);
      setSaveState('saved');
    } catch (saveError) {
      setError(saveError.message);
      setSaveState('idle');
    }
  }

  function exportCorrectedJson() {
    const corrected = records.map(correctedRecord);
    const blob = new Blob([JSON.stringify(corrected, null, 2)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'services.corrected.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function renderField(field) {
    const value = activeRecord?.[field.key] || '';
    const commonProps = {
      value,
      dir: 'auto',
      onChange: (event) => handleFieldChange(field.key, event.target.value),
      className: 'editable-control',
      spellCheck: false
    };

    return (
      <label className="field-row" key={field.key}>
        <span>{text[field.labelKey]}</span>
        {field.type === 'textarea' ? (
          <textarea {...commonProps} rows={field.key === 'required_documents' ? 8 : 5} />
        ) : (
          <input {...commonProps} type="text" />
        )}
      </label>
    );
  }

  return (
    <main className={`dashboard ${direction}`} dir={direction} data-language={language}>
      <header className="topbar">
        <div className="title-block">
          <h1>{text.title}</h1>
          <p className="database-status">
            {loadState === 'loading' ? text.loading : databaseReady ? text.databaseReady : text.databaseIssue}
          </p>
        </div>

        <div className="top-controls" aria-label="Dashboard controls">
          <div className="stat-card">
            <span>{text.services}</span>
            <strong>{records.length}</strong>
          </div>
          <div className="stat-card">
            <span>{text.pending}</span>
            <strong>{pendingCount}</strong>
          </div>
          <button className="secondary-button" type="button" onClick={exportCorrectedJson}>
            {text.exportCorrected}
          </button>
          <button className="language-toggle" type="button" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}>
            {language === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>
      </header>

      {error ? <p className="error-message">{text.databaseIssue}: {error}</p> : null}

      <section className={`workspace ${direction}`} data-sidebar-position={sidebarPosition}>
        <aside className="records-panel" aria-label={text.records}>
          <div className="panel-heading">
            <h2>{text.records}</h2>
          </div>

          <input
            className="search-input"
            dir="auto"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={text.searchPlaceholder}
          />

          <div className="filter-row" aria-label="Record filters">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                className={filter === option.value ? 'filter-chip active' : 'filter-chip'}
                type="button"
                onClick={() => setFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="record-list">
            {filteredRecords.map((record) => (
              <button
                key={record.id}
                className={activeRecord?.id === record.id ? 'record-card active' : 'record-card'}
                type="button"
                onClick={() => setActiveId(record.id)}
              >
                <span className="record-code" dir="auto">{record.service_code}</span>
                <strong dir="auto">{record.service_name}</strong>
                <small dir="auto">{record.ministry}</small>
                <span className="status-pill">{COPY[language][record.status] || record.status}</span>
              </button>
            ))}
            {filteredRecords.length === 0 ? <p className="empty-state">{text.empty}</p> : null}
          </div>
        </aside>

        <section className="editor-panel">
          {activeRecord ? (
            <>
              <div className="editor-header">
                <div>
                  <p className="eyebrow">{text.records}</p>
                  <h2 dir="auto">{activeRecord.service_name}</h2>
                </div>
                <span className="save-state">
                  {saveState === 'saving' ? text.saving : saveState === 'saved' ? text.savedState : ''}
                </span>
              </div>

              <div className="meta-row">
                <div className="meta-pill">
                  <span>{text.serviceCode}</span>
                  <strong dir="auto">{activeRecord.service_code}</strong>
                </div>
                <div className="meta-pill">
                  <span>{text.ministry}</span>
                  <strong dir="auto">{activeRecord.ministry}</strong>
                </div>
              </div>

              <div className="editor-fields">
                {EDITABLE_FIELDS.map(renderField)}
              </div>

              <div className="editor-actions">
                <button className="primary-button" type="button" onClick={handleSave}>
                  {text.save}
                </button>
              </div>
            </>
          ) : (
            <p className="empty-state large">{text.chooseRecord}</p>
          )}
        </section>
      </section>
    </main>
  );
}
