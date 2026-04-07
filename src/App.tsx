/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Fuse from 'fuse.js';
import { 
  Plus, 
  Search, 
  RefreshCw, 
  ChevronDown, 
  ChevronRight, 
  CheckCircle2, 
  Trash2, 
  Archive, 
  Edit3, 
  MoreVertical,
  AlertCircle,
  Clock,
  User,
  Hash,
  FileText,
  X,
  Palette,
  Filter,
  ArrowUpDown,
  CheckSquare,
  Square,
  Download,
  Settings,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

type Urgency = 'Normal' | 'High' | 'Urgent';
type Status = 'active' | 'completed' | 'archived';
type EntryType = 'IBT' | 'CITY CALL' | 'CUSTOMER ORDER' | 'SHIPPING' | 'EECOL VAN';

interface WireItem {
  id: string;
  orderNumber: string;
  entryType: EntryType;
  lineNumber: string;
  customer: string;
  wireType: string;
  lengthZ: string;
  urgency: Urgency;
  status: Status;
  wireDescription: string;
  orderComments: string;
  shipperComments: string;
  removalReason?: string;
  color: string;
  position: number;
  createdAt: number;
}

interface Settings {
  toastDuration: number;
  showSuccessToasts: boolean;
  showInfoToasts: boolean;
  showErrorToasts: boolean;
}

// --- Constants ---

const COLORS = [
  { name: 'White', value: '#ffffff' },
  { name: 'Red', value: '#fef2f2' },
  { name: 'Green', value: '#f0fdf4' },
  { name: 'Blue', value: '#eff6ff' },
  { name: 'Yellow', value: '#fffbeb' },
  { name: 'Purple', value: '#faf5ff' },
  { name: 'Pink', value: '#fdf2f8' },
  { name: 'Orange', value: '#fff7ed' },
];

// --- Components ---

const Toast = ({ message, type, duration, onClose }: { message: string, type: 'success' | 'error' | 'info', duration: number, onClose: () => void, key?: string }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgClass = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-rose-600' : 'bg-blue-700';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`${bgClass} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 min-w-[200px] max-w-sm pointer-events-auto`}
    >
      <span className="text-lg">
        {type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
      </span>
      <span className="font-bold text-sm">{message}</span>
    </motion.div>
  );
};

export default function App() {
  // --- State ---
  const [items, setItems] = useState<WireItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('active');
  const [entryTypeFilter, setEntryTypeFilter] = useState<EntryType | 'all'>('all');
  const [sortBy, setSortBy] = useState<keyof WireItem>('position');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isListExpanded, setIsListExpanded] = useState(true);
  const [toasts, setToasts] = useState<{ id: string, message: string, type: 'success' | 'error' | 'info' }[]>([]);
  
  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    toastDuration: 3000,
    showSuccessToasts: true,
    showInfoToasts: true,
    showErrorToasts: true,
  });
  const [editingItem, setEditingItem] = useState<Partial<WireItem> | null>(null);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [removalReason, setRemovalReason] = useState('');

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, itemId: string } | null>(null);

  // --- Persistence ---
  useEffect(() => {
    const savedItems = localStorage.getItem('eecol_wire_list');
    if (savedItems) {
      try {
        setItems(JSON.parse(savedItems));
      } catch (e) {
        console.error("Failed to parse saved items", e);
      }
    }

    const savedSettings = localStorage.getItem('eecol_wire_settings');
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to parse saved settings", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('eecol_wire_list', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('eecol_wire_settings', JSON.stringify(settings));
  }, [settings]);

  // --- Helpers ---
  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (type === 'success' && !settings.showSuccessToasts) return;
    if (type === 'info' && !settings.showInfoToasts) return;
    if (type === 'error' && !settings.showErrorToasts) return;

    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const filteredItems = useMemo(() => {
    let result = [...items];

    // Filter by Status
    if (statusFilter !== 'all') {
      result = result.filter(item => item.status === statusFilter);
    }

    // Filter by Entry Type
    if (entryTypeFilter !== 'all') {
      result = result.filter(item => item.entryType === entryTypeFilter);
    }

    // Fuzzy Search
    if (searchTerm) {
      const fuse = new Fuse(result, {
        keys: ['orderNumber', 'customer', 'wireType', 'wireDescription', 'lineNumber'],
        threshold: 0.3,
      });
      result = fuse.search(searchTerm).map(r => r.item);
    }

    // Sorting
    result.sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];

      if (sortBy === 'urgency') {
        const urgencyMap = { 'Urgent': 3, 'High': 2, 'Normal': 1 };
        const scoreA = urgencyMap[a.urgency] || 0;
        const scoreB = urgencyMap[b.urgency] || 0;
        return sortOrder === 'asc' ? scoreA - scoreB : scoreB - scoreA;
      }

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      }
      
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }

      return 0;
    });

    return result;
  }, [items, searchTerm, statusFilter, entryTypeFilter, sortBy, sortOrder]);

  const openEditModal = (item: WireItem) => {
    setEditingItem(item);
    setIsEditModalOpen(true);
  };

  // --- Actions ---
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedIds(next);
  };

  const handleBulkComplete = () => {
    setItems(prev => prev.map(item => 
      selectedIds.has(item.id) ? { ...item, status: 'completed' } : item
    ));
    addToast(`Marked ${selectedIds.size} items as completed`, 'success');
    setSelectedIds(new Set());
  };

  const handleBulkArchive = () => {
    const reason = window.prompt('Enter reason for bulk removal:');
    if (reason === null) return;
    
    setItems(prev => prev.map(item => 
      selectedIds.has(item.id) ? { ...item, status: 'archived', removalReason: reason || 'Bulk removal' } : item
    ));
    addToast(`Archived ${selectedIds.size} items`, 'success');
    setSelectedIds(new Set());
  };

  const handleBulkRestore = () => {
    setItems(prev => prev.map(item => 
      selectedIds.has(item.id) ? { ...item, status: 'active' } : item
    ));
    addToast(`Restored ${selectedIds.size} items to active list`, 'success');
    setSelectedIds(new Set());
  };

  const exportToCSV = () => {
    if (filteredItems.length === 0) {
      addToast('No items to export', 'error');
      return;
    }

    const headers = [
      'Order Number', 'Line Number', 'Entry Type', 'Customer', 
      'Wire Type', 'Length (Z)', 'Urgency', 'Status', 
      'Description', 'Order Comments', 'Shipper Comments', 'Removal Reason', 'Created At'
    ];

    const rows = filteredItems.map(item => [
      item.orderNumber,
      item.lineNumber,
      item.entryType,
      item.customer,
      item.wireType,
      item.lengthZ,
      item.urgency,
      item.status,
      `"${(item.wireDescription || '').replace(/"/g, '""')}"`,
      `"${(item.orderComments || '').replace(/"/g, '""')}"`,
      `"${(item.shipperComments || '').replace(/"/g, '""')}"`,
      `"${(item.removalReason || '').replace(/"/g, '""')}"`,
      new Date(item.createdAt).toLocaleString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `eecol_wire_list_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('CSV exported successfully', 'success');
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const newItem: WireItem = {
      id: editingItem.id || crypto.randomUUID(),
      orderNumber: editingItem.orderNumber || '',
      entryType: editingItem.entryType || 'IBT',
      lineNumber: editingItem.lineNumber || '',
      customer: editingItem.customer || '',
      wireType: editingItem.wireType || '',
      lengthZ: editingItem.lengthZ || '0',
      urgency: editingItem.urgency || 'Normal',
      status: editingItem.status || 'active',
      wireDescription: editingItem.wireDescription || '',
      orderComments: editingItem.orderComments || '',
      shipperComments: editingItem.shipperComments || '',
      color: editingItem.color || '#ffffff',
      position: editingItem.position ?? items.length,
      createdAt: editingItem.createdAt || Date.now(),
    };

    if (editingItem.id) {
      setItems(prev => prev.map(item => item.id === newItem.id ? newItem : item));
      addToast('Item updated successfully', 'success');
    } else {
      setItems(prev => [...prev, newItem]);
      addToast('Item added successfully', 'success');
    }

    setIsEditModalOpen(false);
    setEditingItem(null);
  };

  const handleComplete = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'completed' } : item));
    addToast('Item marked as completed', 'success');
  };

  const handleArchive = () => {
    if (!archivingId || !removalReason) {
      addToast('Please provide a reason for removal', 'error');
      return;
    }
    setItems(prev => prev.map(item => 
      item.id === archivingId ? { ...item, status: 'archived', removalReason } : item
    ));
    addToast('Item archived', 'success');
    setIsArchiveModalOpen(false);
    setArchivingId(null);
    setRemovalReason('');
  };

  const handleRestore = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'active' } : item));
    addToast('Item restored to active list', 'success');
  };

  const handleDuplicate = (id: string) => {
    const original = items.find(i => i.id === id);
    if (!original) return;
    const newItem: WireItem = {
      ...original,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      position: items.length,
      orderNumber: `${original.orderNumber} (Copy)`,
    };
    setItems(prev => [...prev, newItem]);
    addToast('Item duplicated', 'success');
  };

  const handleRemoveFlat = (id: string) => {
    if (window.confirm('Permanently delete this item?')) {
      setItems(prev => prev.filter(item => item.id !== id));
      addToast('Item permanently deleted', 'error');
    }
  };

  const handleColorChange = (id: string, color: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, color } : item));
    setContextMenu(null);
  };

  // --- Drag and Drop ---
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const onDragStart = (id: string) => {
    setDraggedId(id);
  };

  const onDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const draggedIndex = items.findIndex(i => i.id === draggedId);
    const targetIndex = items.findIndex(i => i.id === targetId);

    const newItems = [...items];
    const [movedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, movedItem);

    // Update positions
    const updatedItems = newItems.map((item, idx) => ({ ...item, position: idx }));
    setItems(updatedItems);
  };

  // --- Render ---
  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans text-gray-900">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="text-center py-6">
          <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-r from-blue-800 to-blue-600 bg-clip-text text-transparent uppercase">
            EECOL – Wire Cut List
          </h1>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Order Management System</p>
        </header>

        {/* Main List Container */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
          {/* List Header / Controls */}
          <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-100">
            <div className="flex items-center justify-between mb-4">
              <button 
                onClick={() => setIsListExpanded(!isListExpanded)}
                className="flex items-center gap-2 font-black text-yellow-800 uppercase text-sm tracking-tight"
              >
                {isListExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                🗂️ Wire Cut List
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setEditingItem({ status: 'active', urgency: 'Normal', color: '#ffffff', entryType: 'IBT' });
                    setIsEditModalOpen(true);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-bold text-xs shadow-sm"
                >
                  <Plus size={14} /> Add Item
                </button>
                <button 
                  onClick={() => setIsSettingsModalOpen(true)}
                  title="Settings"
                  aria-label="Open settings"
                  className="p-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-sm"
                >
                  <Settings size={14} />
                </button>
                <button 
                  onClick={() => addToast('List refreshed', 'info')}
                  aria-label="Refresh list"
                  className="p-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition shadow-sm"
                >
                  <RefreshCw size={14} />
                </button>
                <button 
                  onClick={exportToCSV}
                  title="Export to CSV"
                  aria-label="Export to CSV"
                  className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
                >
                  <Download size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-yellow-400" size={14} />
                  <input 
                    type="text" 
                    placeholder="Fuzzy search (Order, Customer, Wire Type...)"
                    aria-label="Search wire items"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white border border-yellow-200 rounded-xl text-xs focus:ring-2 focus:ring-yellow-500 outline-none transition"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="status-filter" className="text-[10px] font-black text-yellow-700 uppercase flex items-center gap-1">
                    <Filter size={10} /> Status:
                  </label>
                  <select 
                    id="status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as Status | 'all')}
                    className="bg-white border border-yellow-200 rounded-xl px-3 py-2 text-xs font-bold text-yellow-800 outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                    <option value="all">All Status</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="type-filter" className="text-[10px] font-black text-yellow-700 uppercase flex items-center gap-1">
                    <Filter size={10} /> Type:
                  </label>
                  <select 
                    id="type-filter"
                    value={entryTypeFilter}
                    onChange={(e) => setEntryTypeFilter(e.target.value as EntryType | 'all')}
                    className="bg-white border border-yellow-200 rounded-xl px-3 py-2 text-xs font-bold text-yellow-800 outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="all">All Types</option>
                    <option value="IBT">IBT</option>
                    <option value="CITY CALL">CITY CALL</option>
                    <option value="CUSTOMER ORDER">CUSTOMER ORDER</option>
                    <option value="SHIPPING">SHIPPING</option>
                    <option value="EECOL VAN">EECOL VAN</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label htmlFor="sort-by" className="text-[10px] font-black text-yellow-700 uppercase flex items-center gap-1">
                    <ArrowUpDown size={10} /> Sort:
                  </label>
                  <select 
                    id="sort-by"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as keyof WireItem)}
                    className="bg-white border border-yellow-200 rounded-xl px-3 py-2 text-xs font-bold text-yellow-800 outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value="position">Manual Order</option>
                    <option value="orderNumber">Order #</option>
                    <option value="customer">Customer</option>
                    <option value="urgency">Urgency</option>
                    <option value="createdAt">Date Created</option>
                  </select>
                  <button 
                    onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    aria-label={`Sort ${sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                    className="p-2 bg-white border border-yellow-200 rounded-xl text-yellow-800 hover:bg-yellow-50 transition"
                  >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Bulk Action Bar */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-blue-600 text-white px-4 py-2 flex items-center justify-between shadow-inner"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black uppercase tracking-widest">{selectedIds.size} Selected</span>
                  <button 
                    onClick={() => setSelectedIds(new Set())}
                    className="text-[10px] font-bold underline hover:text-blue-100"
                  >
                    Deselect All
                  </button>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={handleBulkComplete}
                    className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-black uppercase transition"
                  >
                    <CheckCircle2 size={12} /> Complete
                  </button>
                  <button 
                    onClick={handleBulkArchive}
                    className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-black uppercase transition"
                  >
                    <Archive size={12} /> Archive
                  </button>
                  <button 
                    onClick={handleBulkRestore}
                    className="flex items-center gap-1 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[10px] font-black uppercase transition"
                  >
                    <RefreshCw size={12} /> Restore
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* List Content */}
          <AnimatePresence>
            {isListExpanded && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-4 space-y-4 min-h-[100px]"
              >
                {filteredItems.length > 0 && (
                  <div className="flex items-center gap-2 mb-2 px-2">
                    <button 
                      onClick={toggleSelectAll}
                      className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition"
                    >
                      {selectedIds.size === filteredItems.length ? <CheckSquare size={14} /> : <Square size={14} />}
                      Select All Visible
                    </button>
                  </div>
                )}
                {filteredItems.length === 0 ? (
                  <div className="py-12 text-center">
                    <AlertCircle className="mx-auto text-gray-300 mb-2" size={32} />
                    <p className="text-gray-400 italic text-sm">No items found in this view.</p>
                  </div>
                ) : (
                  filteredItems.map((item, index) => (
                    <motion.div
                      key={item.id}
                      layout
                      draggable
                      onDragStart={() => onDragStart(item.id)}
                      onDragOver={(e) => onDragOver(e, item.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id });
                      }}
                      onClick={() => toggleExpand(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpand(item.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-expanded={expandedIds.has(item.id)}
                      aria-label={`Wire item ${item.orderNumber} for ${item.customer}. Click to expand details.`}
                      className={`relative group border-2 rounded-2xl p-4 transition-all hover:shadow-lg cursor-pointer outline-none focus:ring-4 focus:ring-blue-200 ${
                        draggedId === item.id ? 'opacity-50 scale-95' : ''
                      } ${
                        selectedIds.has(item.id) ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-100'
                      } ${
                        item.urgency === 'Urgent' ? 'border-l-8 border-l-red-600 shadow-[0_0_15px_rgba(220,38,38,0.1)]' : 
                        item.urgency === 'High' ? 'border-l-8 border-l-orange-500' : 
                        'border-l-8 border-l-blue-400'
                      }`}
                      style={{ backgroundColor: item.color }}
                    >
                      {/* Selection Checkbox */}
                      <div 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(item.id);
                        }}
                        role="checkbox"
                        aria-checked={selectedIds.has(item.id)}
                        aria-label="Select item"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSelect(item.id);
                          }
                        }}
                        className={`absolute top-4 right-4 w-6 h-6 rounded-lg flex items-center justify-center transition-all outline-none focus:ring-2 focus:ring-blue-400 ${
                          selectedIds.has(item.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-300 hover:bg-gray-200'
                        }`}
                      >
                        {selectedIds.has(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </div>

                      {/* Item Header */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex gap-3">
                          <div className="bg-blue-50 text-blue-700 w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shadow-inner">
                            {index + 1}
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                              <Hash size={10} /> Order / Line
                            </span>
                            <div className="text-sm font-black text-gray-800 flex items-center gap-2">
                              {item.orderNumber || 'N/A'} / {item.lineNumber || 'N/A'}
                              {item.entryType && (
                                <span className="bg-amber-100 text-amber-800 text-[9px] px-2 py-0.5 rounded-full border border-amber-200 font-black">
                                  {item.entryType}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-end gap-1">
                            <User size={10} /> Customer
                          </span>
                          <div className="text-xs font-bold text-gray-700">{item.customer || 'N/A'}</div>
                        </div>
                      </div>

                      {/* Item Body */}
                      <div className="bg-white/40 backdrop-blur-sm p-3 rounded-xl border border-black/5 mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-black text-blue-800 text-[11px] uppercase tracking-tighter flex items-center gap-1">
                            <FileText size={12} /> {item.wireType || 'Wire Type: N/A'}
                          </span>
                          <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                            {item.lengthZ || '0'} Z
                          </span>
                        </div>
                        <p className="text-xs font-medium text-gray-600 leading-relaxed">{item.wireDescription || 'No description provided.'}</p>
                        
                        <div className="mt-2 flex items-center gap-2">
                          <Clock size={10} className={item.urgency === 'Urgent' ? 'text-red-500' : 'text-gray-400'} />
                          <span className={`text-[10px] font-black uppercase tracking-wider ${
                            item.urgency === 'Urgent' ? 'text-red-600' : 
                            item.urgency === 'High' ? 'text-orange-600' : 
                            'text-gray-400'
                          }`}>
                            {item.urgency} Urgency
                          </span>
                        </div>
                      </div>

                      {/* Comments & Meta */}
                      <AnimatePresence>
                        {expandedIds.has(item.id) && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="flex flex-wrap gap-2 mb-4 pt-2 border-t border-black/5 mt-2">
                              {item.orderComments ? (
                                <div className="w-full bg-rose-50 text-rose-600 text-[10px] font-bold px-3 py-2 rounded-lg border border-rose-100 flex items-start gap-2">
                                  <AlertCircle size={12} className="mt-0.5 shrink-0" /> 
                                  <div>
                                    <span className="uppercase block text-[8px] opacity-70">Order Comments</span>
                                    {item.orderComments}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full text-[9px] text-gray-400 italic px-3">No order comments.</div>
                              )}
                              
                              {item.shipperComments ? (
                                <div className="w-full bg-blue-50 text-blue-600 text-[10px] font-bold px-3 py-2 rounded-lg border border-blue-100 flex items-start gap-2">
                                  <RefreshCw size={12} className="mt-0.5 shrink-0" /> 
                                  <div>
                                    <span className="uppercase block text-[8px] opacity-70">Shipper Comments</span>
                                    {item.shipperComments}
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full text-[9px] text-gray-400 italic px-3">No shipper comments.</div>
                              )}

                              {item.status === 'archived' && item.removalReason && (
                                <div className="w-full bg-gray-100 text-gray-600 text-[10px] font-bold px-3 py-2 rounded-lg border border-gray-200 flex items-start gap-2">
                                  <Archive size={12} className="mt-0.5 shrink-0" />
                                  <div>
                                    <span className="uppercase block text-[8px] opacity-70">Removal Reason</span>
                                    {item.removalReason}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {!expandedIds.has(item.id) && (
                        <div className="flex flex-wrap gap-2 mb-4 opacity-60">
                          {item.orderComments && (
                            <div className="bg-rose-50 text-rose-600 text-[9px] font-bold px-2 py-0.5 rounded border border-rose-100 truncate max-w-[150px]">
                              💬 {item.orderComments}
                            </div>
                          )}
                          {item.shipperComments && (
                            <div className="bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded border border-blue-100 truncate max-w-[150px]">
                              🚚 {item.shipperComments}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer Actions */}
                      <div className="flex justify-between items-center pt-3 border-t border-black/5">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openEditModal(item as WireItem)}
                            aria-label="Edit item"
                            className="p-1.5 text-gray-400 hover:text-blue-600 transition"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id });
                            }}
                            aria-label="More options"
                            className="p-1.5 text-gray-400 hover:text-gray-600 transition"
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          {item.status === 'active' ? (
                            <>
                              <button 
                                onClick={() => handleComplete(item.id)}
                                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition shadow-sm uppercase tracking-tight"
                              >
                                <CheckCircle2 size={12} /> Complete
                              </button>
                              <button 
                                onClick={() => {
                                  setArchivingId(item.id);
                                  setIsArchiveModalOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 text-white rounded-xl text-[10px] font-black hover:bg-rose-700 transition shadow-sm uppercase tracking-tight"
                              >
                                <Trash2 size={12} /> Remove
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => handleRestore(item.id)}
                              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-600 text-white rounded-xl text-[10px] font-black hover:bg-gray-700 transition shadow-sm uppercase tracking-tight"
                            >
                              <RefreshCw size={12} /> Restore
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <footer className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] py-8">
          © 2026 EECOL Electric • Wire Management Portal
        </footer>
      </div>

      {/* --- Modals --- */}

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl border-4 border-yellow-400 w-full max-w-xl overflow-hidden"
            >
              <form onSubmit={handleSaveItem} className="p-8">
                <div className="flex flex-col items-center mb-8">
                  <div className="w-16 h-16 bg-blue-700 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg mb-4">E</div>
                  <h3 className="text-2xl font-black text-blue-900 tracking-tighter uppercase">
                    {editingItem?.id ? 'Edit Wire Item' : 'Add New Wire Item'}
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">
                  <div className="space-y-1">
                    <label htmlFor="edit-order" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Order #</label>
                    <input 
                      id="edit-order"
                      required
                      value={editingItem?.orderNumber || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, orderNumber: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="edit-type" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Entry Type</label>
                    <select 
                      id="edit-type"
                      value={editingItem?.entryType || 'IBT'}
                      onChange={e => setEditingItem(prev => ({ ...prev, entryType: e.target.value as EntryType }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="IBT">IBT</option>
                      <option value="CITY CALL">CITY CALL</option>
                      <option value="CUSTOMER ORDER">CUSTOMER ORDER</option>
                      <option value="SHIPPING">SHIPPING</option>
                      <option value="EECOL VAN">EECOL VAN</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="edit-line" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Line #</label>
                    <input 
                      id="edit-line"
                      value={editingItem?.lineNumber || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, lineNumber: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="edit-customer" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Customer</label>
                    <input 
                      id="edit-customer"
                      value={editingItem?.customer || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, customer: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="edit-wire" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Wire Type</label>
                    <input 
                      id="edit-wire"
                      value={editingItem?.wireType || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, wireType: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="edit-length" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Length (Z)</label>
                    <input 
                      id="edit-length"
                      type="number"
                      value={editingItem?.lengthZ || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, lengthZ: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="edit-urgency" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Urgency</label>
                    <select 
                      id="edit-urgency"
                      value={editingItem?.urgency || 'Normal'}
                      onChange={e => setEditingItem(prev => ({ ...prev, urgency: e.target.value as Urgency }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="edit-status" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Status</label>
                    <select 
                      id="edit-status"
                      value={editingItem?.status || 'active'}
                      onChange={e => setEditingItem(prev => ({ ...prev, status: e.target.value as Status }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <label htmlFor="edit-desc" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Description</label>
                    <input 
                      id="edit-desc"
                      value={editingItem?.wireDescription || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, wireDescription: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <label htmlFor="edit-order-comm" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Order Comments</label>
                    <textarea 
                      id="edit-order-comm"
                      value={editingItem?.orderComments || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, orderComments: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <label htmlFor="edit-ship-comm" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Shipper Comments</label>
                    <textarea 
                      id="edit-ship-comm"
                      value={editingItem?.shipperComments || ''}
                      onChange={e => setEditingItem(prev => ({ ...prev, shipperComments: e.target.value }))}
                      className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm h-20 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    />
                  </div>
                  <div className="col-span-1 sm:col-span-2 space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Card Color</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200">
                      {COLORS.map(c => (
                        <button 
                          key={c.name}
                          type="button"
                          onClick={() => setEditingItem(prev => ({ ...prev, color: c.value }))}
                          aria-label={`Select ${c.name} color`}
                          className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                            editingItem?.color === c.value ? 'border-blue-600 scale-110 shadow-md' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor: c.value }}
                        >
                          {editingItem?.color === c.value && <Check size={14} className="text-blue-600" />}
                        </button>
                      ))}
                      <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-200">
                        <input 
                          type="color" 
                          value={editingItem?.color || '#ffffff'}
                          onChange={e => setEditingItem(prev => ({ ...prev, color: e.target.value }))}
                          className="w-8 h-8 rounded-full cursor-pointer border-none bg-transparent"
                          title="Custom Color"
                        />
                        <input 
                          type="text"
                          value={editingItem?.color || '#ffffff'}
                          onChange={e => setEditingItem(prev => ({ ...prev, color: e.target.value }))}
                          placeholder="#hex"
                          className="w-20 p-1 text-[10px] font-mono border border-gray-200 rounded uppercase outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center gap-4 mt-8">
                  <button 
                    type="button"
                    onClick={() => setIsEditModalOpen(false)} 
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition"
                  >
                    Cancel
                  </button>
                  {editingItem?.id && (
                    <button 
                      type="button"
                      onClick={() => {
                        handleDuplicate(editingItem.id!);
                        setIsEditModalOpen(false);
                      }}
                      className="px-6 py-3 bg-amber-100 text-amber-700 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-amber-200 transition flex items-center gap-2"
                    >
                      <Copy size={14} /> Duplicate
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="px-8 py-3 bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-800 transition shadow-lg shadow-blue-200"
                  >
                    Save Item
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Archive Reason Modal */}
      <AnimatePresence>
        {isArchiveModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsArchiveModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl border-4 border-rose-500 w-full max-w-md p-8"
            >
              <div className="flex flex-col items-center mb-6">
                <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600 mb-4">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Reason for Removal</h3>
                <p className="text-center text-gray-500 mt-2 text-xs font-medium">Please specify why this item is being removed.</p>
              </div>

              <label htmlFor="removal-reason" className="sr-only">Removal Reason</label>
              <textarea 
                id="removal-reason"
                autoFocus
                value={removalReason}
                onChange={e => setRemovalReason(e.target.value)}
                placeholder="e.g., Customer cancelled, incorrect wire type specified..." 
                className="w-full p-4 bg-gray-50 border-2 border-gray-100 rounded-2xl text-sm h-40 mb-8 focus:border-rose-500 outline-none transition resize-none"
              />

              <div className="flex justify-center gap-4">
                <button 
                  onClick={() => setIsArchiveModalOpen(false)} 
                  className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleArchive}
                  className="px-8 py-3 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-rose-700 transition shadow-lg shadow-rose-200"
                >
                  Archive Item
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl border-4 border-gray-600 w-full max-w-md p-8"
            >
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-600 mb-4">
                  <Settings size={32} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">Application Settings</h3>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="toast-duration" className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Toast Duration (ms)</label>
                  <input 
                    id="toast-duration"
                    type="number"
                    step="500"
                    min="1000"
                    max="10000"
                    value={settings.toastDuration}
                    onChange={e => setSettings(prev => ({ ...prev, toastDuration: parseInt(e.target.value) || 3000 }))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-500 outline-none"
                  />
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Notification Types</span>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition">
                      <input 
                        type="checkbox"
                        checked={settings.showSuccessToasts}
                        onChange={e => setSettings(prev => ({ ...prev, showSuccessToasts: e.target.checked }))}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-xs font-bold text-gray-700">Show Success Alerts</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition">
                      <input 
                        type="checkbox"
                        checked={settings.showInfoToasts}
                        onChange={e => setSettings(prev => ({ ...prev, showInfoToasts: e.target.checked }))}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-gray-700">Show Info Alerts</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer hover:bg-gray-100 transition">
                      <input 
                        type="checkbox"
                        checked={settings.showErrorToasts}
                        onChange={e => setSettings(prev => ({ ...prev, showErrorToasts: e.target.checked }))}
                        className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500"
                      />
                      <span className="text-xs font-bold text-gray-700">Show Error Alerts</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-center mt-8">
                <button 
                  onClick={() => setIsSettingsModalOpen(false)} 
                  className="px-12 py-3 bg-gray-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition shadow-lg"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div 
              className="fixed inset-0 z-[100]" 
              onClick={() => setContextMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-[101] bg-white border border-gray-200 shadow-2xl rounded-2xl min-w-[200px] overflow-hidden p-1.5"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button 
                onClick={() => {
                  const item = items.find(i => i.id === contextMenu.itemId);
                  if (item) openEditModal(item);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-xl transition"
              >
                <Edit3 size={14} className="text-blue-500" /> Edit Item
              </button>

              <button 
                onClick={() => {
                  handleDuplicate(contextMenu.itemId);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 rounded-xl transition"
              >
                <Copy size={14} className="text-amber-500" /> Duplicate Item
              </button>
              
              <div className="py-2 px-3">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                  <Palette size={10} /> Change Color
                </span>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {COLORS.map(c => (
                    <button 
                      key={c.name}
                      onClick={() => handleColorChange(contextMenu.itemId, c.value)}
                      title={c.name}
                      aria-label={`Set color to ${c.name}`}
                      className="w-6 h-6 rounded-full border border-gray-200 shadow-sm transition hover:scale-110"
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
                  <input 
                    type="color" 
                    onChange={(e) => handleColorChange(contextMenu.itemId, e.target.value)}
                    className="w-6 h-6 rounded-full cursor-pointer border-none bg-transparent"
                    title="Custom Color"
                  />
                  <span className="text-[8px] font-bold text-gray-400 uppercase">Custom</span>
                </div>
              </div>

              <div className="h-px bg-gray-100 my-1.5" />
              
              <button 
                onClick={() => {
                  handleRemoveFlat(contextMenu.itemId);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition"
              >
                <Trash2 size={14} /> Delete Permanently
              </button>
              <button 
                onClick={() => {
                  setArchivingId(contextMenu.itemId);
                  setIsArchiveModalOpen(true);
                  setContextMenu(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-xl transition"
              >
                <Archive size={14} /> Archive Item
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast Container */}
      <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <Toast 
              key={toast.id} 
              message={toast.message} 
              type={toast.type} 
              duration={settings.toastDuration}
              onClose={() => removeToast(toast.id)} 
            />
          ))}
        </AnimatePresence>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
      `}</style>
    </div>
  );
}
