import React, { useState } from 'react';
import { useNetworkData } from '../hooks/useNetworkData';
import ENDPOINTS from '../services/endpoints';
import './DataLoader.css';

const DATA_FILES = [
  { key: 'networks', label: 'Networks', description: 'Network master records' },
  { key: 'regions', label: 'Regions', description: 'Regional hierarchy data' },
  { key: 'counties', label: 'Counties', description: 'County definitions' },
  { key: 'contractors', label: 'Contractors', description: 'Vendor and contractor profiles' },
  { key: 'ict_officers', label: 'ICT Officers', description: 'Officer contact details' },
  { key: 'sites', label: 'Sites', description: 'Site inventory and status data' },
];

const buildApiUrl = (endpoint) => {
  const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (configuredBaseUrl) {
    return `${configuredBaseUrl.replace(/\/$/, '')}${normalizedEndpoint}`;
  }

  return normalizedEndpoint;
};

const DataLoader = () => {
  const { refetchAll } = useNetworkData();
  const [files, setFiles] = useState({});
  const [autoPoll, setAutoPoll] = useState(true);
  const [replaceExistingRows, setReplaceExistingRows] = useState(false);
  const [tableToRemove, setTableToRemove] = useState('sites');
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isRemovingTable, setIsRemovingTable] = useState(false);
  const [message, setMessage] = useState({ type: '', title: '', text: '' });

  const handleFileChange = (key, event) => {
    const selectedFile = event.target.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: selectedFile }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const selectedFiles = Object.entries(files).filter(([, file]) => file);
    if (selectedFiles.length === 0) {
      setMessage({
        type: 'error',
        title: 'No files selected',
        text: 'Select at least one CSV file before importing.',
      });
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach(([key, file]) => formData.append(key, file));
    const clearTableQuery = replaceExistingRows && tableToRemove ? `&clear_table=${encodeURIComponent(tableToRemove)}` : '';

    setIsUploading(true);
    setMessage({
      type: 'info',
      title: 'Import in progress',
      text: 'Uploading and processing your CSV files. This may take a moment.',
    });

    try {
      const response = await fetch(
        `${buildApiUrl(ENDPOINTS.CSV_IMPORT)}?auto_poll=${autoPoll}${clearTableQuery}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || 'Import failed.');
      }

      const summary = data?.imported ? JSON.stringify(data.imported, null, 2) : 'Import completed.';
      setMessage({
        type: 'success',
        title: 'Import completed successfully',
        text: `The data import finished successfully. ${summary}`,
      });
      setFiles({});
      event.target.reset();
      refetchAll();
    } catch (error) {
      setMessage({
        type: 'error',
        title: 'Import failed',
        text: error.message || 'The import could not be completed. Please review the file format and try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearData = async () => {
    const confirmed = window.confirm('This will permanently remove all imported monitoring data from the database. Continue?');
    if (!confirmed) return;

    setIsClearing(true);
    setMessage({ type: 'info', title: 'Clearing data', text: 'Removing imported records from the database…' });

    try {
      const response = await fetch(
        buildApiUrl(ENDPOINTS.CLEAR_IMPORTED_DATA),
        {
          method: 'POST',
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to clear imported data.');
      }

      setMessage({
        type: 'success',
        title: 'Data cleared successfully',
        text: `Imported records were removed. ${data?.message || ''}`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        title: 'Clear failed',
        text: error.message || 'Unable to clear imported data right now.',
      });
    } finally {
      setIsClearing(false);
    }
  };

  const handleRemoveSpecificTable = async () => {
    const confirmed = window.confirm(`This will permanently remove the ${tableToRemove} data from the database. Continue?`);
    if (!confirmed) return;

    setIsRemovingTable(true);
    setMessage({ type: 'info', title: 'Removing table data', text: `Removing ${tableToRemove} records from the database…` });

    try {
      const url = `${buildApiUrl(ENDPOINTS.CLEAR_IMPORTED_DATA)}?table=${encodeURIComponent(tableToRemove)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'Accept': 'application/json',
        },
        body: `table=${encodeURIComponent(tableToRemove)}`,
      });

      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || `Request failed with ${response.status}`);
      }

      setMessage({
        type: 'success',
        title: 'Table data removed',
        text: `${tableToRemove} records were removed. ${data?.message || 'The request completed successfully.'}`,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        title: 'Table removal failed',
        text: error.message || 'Unable to remove the selected table data right now.',
      });
    } finally {
      setIsRemovingTable(false);
    }
  };

  const selectedCount = Object.values(files).filter(Boolean).length;
  const selectedTableLabel = DATA_FILES.find((file) => file.key === tableToRemove)?.label || tableToRemove;

  return (
    <div className="data-loader-container">
      <div className="data-loader-header">
        <div>
          <h1 className="data-loader-title">Load Network Data</h1>
          <p className="data-loader-subtitle">
            Upload CSV files to populate the dashboard tables and inventory views.
          </p>
        </div>
      </div>

      <form className="data-loader-form" onSubmit={handleSubmit}>
        <div className="data-loader-controls">
          <label className="data-loader-toggle">
            <input
              type="checkbox"
              checked={autoPoll}
              onChange={(event) => setAutoPoll(event.target.checked)}
            />
            Poll sites automatically after import
          </label>

          <label className="data-loader-toggle">
            <input
              type="checkbox"
              checked={replaceExistingRows}
              onChange={(event) => setReplaceExistingRows(event.target.checked)}
            />
            Replace existing rows in the selected table during import
          </label>

          <label className="data-loader-inline">
            <span>Table to remove</span>
            <select value={tableToRemove} onChange={(event) => setTableToRemove(event.target.value)}>
              {DATA_FILES.map((file) => (
                <option key={file.key} value={file.key}>
                  {file.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="data-loader-grid">
          {DATA_FILES.map((file) => (
            <label key={file.key} className="data-loader-card">
              <div className="card-header">
                <span className="card-title">{file.label}</span>
                <span className="card-description">{file.description}</span>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={(event) => handleFileChange(file.key, event)}
              />
              <span className="file-status">
                {files[file.key] ? `Selected: ${files[file.key].name}` : 'No file selected'}
              </span>
            </label>
          ))}
        </div>

        <div className="data-loader-actions">
          <button type="submit" className="import-button" disabled={isUploading || selectedCount === 0}>
            {isUploading ? 'Importing…' : 'Import selected files'}
          </button>
          <button
            type="button"
            className="clear-button"
            onClick={handleClearData}
            disabled={isClearing || isUploading}
          >
            {isClearing ? 'Clearing…' : 'Remove all imported data'}
          </button>
          <button
            type="button"
            className="clear-button"
            onClick={handleRemoveSpecificTable}
            disabled={isRemovingTable || isClearing || isUploading}
          >
            {isRemovingTable ? 'Removing…' : `Remove ${selectedTableLabel} data`}
          </button>
          <span className="selection-count">{selectedCount} file(s) selected</span>
        </div>

        {message.text && (
          <div className={`status-message ${message.type}`} role="alert">
            <div className="status-message-title">{message.title}</div>
            <div className="status-message-text">{message.text}</div>
          </div>
        )}
      </form>
    </div>
  );
};

export default DataLoader;
