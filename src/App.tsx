/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Download, 
  Barcode, 
  Camera,
  Upload,
  X, 
  ChevronRight, 
  ChevronDown, 
  Save, 
  FileText,
  Building2,
  User,
  Clock,
  MapPin,
  Calendar as CalendarIcon,
  Search,
  Check,
  GripHorizontal,
  Filter,
  ArrowUpDown
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { cn } from './lib/utils';

import { extractCylinderInfo } from './services/geminiService';

// Types
interface Cylinder {
  id: string;
  product: string;
  serialNumber: string;
  isMedicinal: boolean;
  isIndustrial: boolean;
  location: string;
}

interface InventoryRecord {
  date: string;
  branch: string;
  customerCode: string;
  customerName: string;
  address: string;
  inspector: string;
  advisor: string;
  timeStart: string;
  timeEnd: string;
  items: Cylinder[];
}

const INITIAL_ITEMS: Cylinder[] = [
  { id: crypto.randomUUID(), product: '', serialNumber: '', isMedicinal: false, isIndustrial: false, location: '' }
];

export default function App() {
  const [record, setRecord] = useState<InventoryRecord>({
    date: format(new Date(), 'yyyy-MM-dd'),
    branch: '',
    customerCode: '',
    customerName: '',
    address: '',
    inspector: '',
    advisor: '',
    timeStart: format(new Date(), 'HH:mm'),
    timeEnd: '',
    items: INITIAL_ITEMS,
  });

  const [activeScanner, setActiveScanner] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>('https://companieslogo.com/img/orig/LIN.DE_BIG-5f05359b.png?t=1602410332');
  const [searchQuery, setSearchQuery] = useState('');
  const [columnOrder, setColumnOrder] = useState(['n', 'product', 'serial', 'type', 'location']);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({ key: '', direction: null });
  const [itemOrder, setItemOrder] = useState<string[]>(INITIAL_ITEMS.map(i => i.id));
  const [loadingRow, setLoadingRow] = useState<string | null>(null);
  const [activeGeminiRow, setActiveGeminiRow] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const geminiFileInputRef = useRef<HTMLInputElement>(null);

  const LOCATION_OPTIONS = [
    'Central', 
    'Emergencia', 
    'UCI', 
    'Cirugía', 
    'Quirófano', 
    'Pediatría', 
    'Hemodiálisis'
  ];

  // Persistence to local storage (optional but helpful for refresh)
  useEffect(() => {
    const saved = localStorage.getItem('cylinder_inventory_draft');
    const savedLogo = localStorage.getItem('cylinder_inventory_logo');
    if (saved) {
      try {
        setRecord(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved draft", e);
      }
    }
    if (savedLogo && savedLogo !== 'null') {
      setLogo(savedLogo);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cylinder_inventory_draft', JSON.stringify(record));
    if (logo) localStorage.setItem('cylinder_inventory_logo', logo);
  }, [record, logo]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setLogo(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field: keyof InventoryRecord, value: string) => {
    setRecord(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (id: string, field: keyof Cylinder, value: string | boolean) => {
    setRecord(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const setAllItemsType = (type: 'medicinal' | 'industrial') => {
    setRecord(prev => ({
      ...prev,
      items: prev.items.map(item => ({
        ...item,
        isMedicinal: type === 'medicinal',
        isIndustrial: type === 'industrial'
      }))
    }));
  };

  const addItem = () => {
    setRecord(prev => ({
      ...prev,
      items: [...prev.items, { 
        id: crypto.randomUUID(), 
        product: '', 
        serialNumber: '', 
        isMedicinal: false, 
        isIndustrial: false, 
        location: '' 
      }]
    }));
  };

  const removeItem = (id: string) => {
    if (record.items.length === 1) return;
    setRecord(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null;
    }
    setSortConfig({ key, direction });
  };

  const reorderRows = (newItems: Cylinder[]) => {
    setRecord(prev => ({ ...prev, items: newItems }));
  };

  const getSortedItems = () => {
    let items = [...record.items];
    
    // Filter
    items = items.filter(item => 
      item.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.product.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
    if (sortConfig.direction && sortConfig.key) {
      items.sort((a, b) => {
        let valA: any, valB: any;
        
        switch (sortConfig.key) {
          case 'product': valA = a.product; valB = b.product; break;
          case 'serial': valA = a.serialNumber; valB = b.serialNumber; break;
          case 'location': valA = a.location; valB = b.location; break;
          case 'type': valA = a.isMedicinal ? 'M' : 'I'; valB = b.isMedicinal ? 'M' : 'I'; break;
          default: valA = 0; valB = 0;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return items;
  };

  const startScanning = (itemId: string) => {
    setActiveScanner(itemId);
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear();
      scannerRef.current = null;
    }
    setActiveScanner(null);
  };

  useEffect(() => {
    if (activeScanner) {
      const scanner = new Html5QrcodeScanner(
        "barcode-reader",
        { 
          fps: 15, 
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            return {
              width: viewfinderWidth * 0.8,
              height: viewfinderHeight * 0.4
            };
          },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          showZoomSliderIfSupported: true,
        },
        /* verbose= */ false
      );

      scanner.render((decodedText) => {
        const text = decodedText.toUpperCase();
        
        // Extended pattern matching for better auto-fill
        let product = '';
        let isMedicinal = false;
        let isIndustrial = false;

        // Specific patterns from the label image provided earlier
        const isMedPattern = text.includes('O2') || text.includes('MED') || text.includes('OXIGENO') || 
                            text.includes('C2GA') || text.includes('SSC10') || text.includes('GAM');
        
        const isIndPattern = text.includes('IND') || text.includes('ARGON') || text.includes('CO2') || 
                            text.includes('NITROGENO') || text.includes('MIX') || text.includes('ATAL');

        if (isMedPattern) {
          product = 'OXÍGENO MEDICINAL';
          isMedicinal = true;
        } else if (isIndPattern) {
          product = text.includes('ARGON') ? 'ARGÓN' : (text.includes('CO2') ? 'CO2 INDUSTRIAL' : 'GAS INDUSTRIAL');
          isIndustrial = true;
        }

        handleItemChange(activeScanner, 'serialNumber', decodedText);
        if (product) handleItemChange(activeScanner, 'product', product);
        if (isMedicinal) {
          handleItemChange(activeScanner, 'isMedicinal', true);
          handleItemChange(activeScanner, 'isIndustrial', false);
        } else if (isIndustrial) {
          handleItemChange(activeScanner, 'isIndustrial', true);
          handleItemChange(activeScanner, 'isMedicinal', false);
        }

        stopScanning();
      }, (error) => {
        // console.warn(error);
      });

      scannerRef.current = scanner;
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [activeScanner]);

  const handleGeminiTrigger = (rowId: string, directCamera = false) => {
    setActiveGeminiRow(rowId);
    if (geminiFileInputRef.current) {
      if (directCamera) {
        geminiFileInputRef.current.setAttribute('capture', 'environment');
      } else {
        geminiFileInputRef.current.removeAttribute('capture');
      }
      geminiFileInputRef.current.click();
    }
  };

  const handleGeminiUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeGeminiRow) {
      const rowId = activeGeminiRow;
      setLoadingRow(rowId);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const result = await extractCylinderInfo(base64);
          if (result) {
            if (result.serialNumber) handleItemChange(rowId, 'serialNumber', result.serialNumber);
            if (result.product) handleItemChange(rowId, 'product', result.product);
            if (result.type === 'medicinal') {
              handleItemChange(rowId, 'isMedicinal', true);
              handleItemChange(rowId, 'isIndustrial', false);
            } else if (result.type === 'industrial') {
              handleItemChange(rowId, 'isIndustrial', true);
              handleItemChange(rowId, 'isMedicinal', false);
            }
          }
        } catch (err) {
          console.error("Gemini failed", err);
        } finally {
          setLoadingRow(null);
          setActiveGeminiRow(null);
          if (geminiFileInputRef.current) geminiFileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF({
      format: 'a4',
      unit: 'mm'
    });
    const lindeBlue = [0, 107, 166];

    const drawHeader = (docInstance: jsPDF, pageNum: number) => {
      const pageWidth = docInstance.internal.pageSize.getWidth();
      
      // Logo
      if (logo) {
        try {
          docInstance.addImage(logo, 'PNG', 10, 8, 45, 18);
        } catch (e) {
          docInstance.setFillColor(lindeBlue[0], lindeBlue[1], lindeBlue[2]);
          docInstance.rect(10, 10, 45, 10, 'F');
          docInstance.setTextColor(255, 255, 255);
          docInstance.setFontSize(8);
          docInstance.text('LINDE', 32, 16, { align: 'center' });
        }
      } else {
        docInstance.setFillColor(lindeBlue[0], lindeBlue[1], lindeBlue[2]);
        docInstance.rect(10, 10, 45, 10, 'F');
        docInstance.setTextColor(255, 255, 255);
        docInstance.setFontSize(8);
        docInstance.text('SUBIR LOGO', 32, 16, { align: 'center' });
      }

      // Title Box
      docInstance.setDrawColor(180);
      docInstance.setLineWidth(0.3);
      docInstance.rect(60, 10, 85, 10);
      docInstance.setTextColor(lindeBlue[0], lindeBlue[1], lindeBlue[2]);
      docInstance.setFontSize(12);
      docInstance.setFont('helvetica', 'bold');
      docInstance.text('INVENTARIO DE CILINDROS', 102.5, 17, { align: 'center' });

      // Right Status Box
      const rightBoxX = 150;
      docInstance.setDrawColor(150);
      docInstance.rect(rightBoxX, 10, 50, 24);
      docInstance.setTextColor(40);
      docInstance.setFontSize(7);
      docInstance.setFont('helvetica', 'normal');
      docInstance.line(rightBoxX, 18, 200, 18);
      docInstance.line(rightBoxX, 26, 200, 26);
      
      docInstance.text('Total cilindros:', rightBoxX + 2, 15);
      docInstance.text(record.items.length.toString(), rightBoxX + 35, 15);
      docInstance.text('Hora Inicio:', rightBoxX + 2, 23);
      docInstance.text(record.timeStart, rightBoxX + 35, 23);
      docInstance.text('Hora Final:', rightBoxX + 2, 31);
      docInstance.text(record.timeEnd || 'En curso', rightBoxX + 35, 31);

      // Client Info Grid
      const infoStartY = 40;
      const infoHeight = 35;
      docInstance.rect(10, infoStartY, 130, infoHeight);
      const rowH = infoHeight / 7;
      for (let i = 1; i < 7; i++) {
        docInstance.line(10, infoStartY + (i * rowH), 140, infoStartY + (i * rowH));
      }
      
      docInstance.setFont('helvetica', 'bold');
      docInstance.text('Fecha Inventario:', 12, infoStartY + rowH * 0.7);
      docInstance.text('Sucursal:', 12, infoStartY + rowH * 1.7);
      docInstance.text('Código de cliente:', 12, infoStartY + rowH * 2.7);
      docInstance.text('Cliente:', 12, infoStartY + rowH * 3.7);
      docInstance.text('Domicilio:', 12, infoStartY + rowH * 4.7);
      docInstance.text('Inspector:', 12, infoStartY + rowH * 5.7);
      docInstance.text('Asesor Comercial:', 12, infoStartY + rowH * 6.7);
      
      docInstance.setFont('helvetica', 'normal');
      const valX = 45;
      docInstance.text(record.date, valX, infoStartY + rowH * 0.7);
      docInstance.text(record.branch, valX, infoStartY + rowH * 1.7);
      docInstance.text(record.customerCode, valX, infoStartY + rowH * 2.7);
      docInstance.text(record.customerName, valX, infoStartY + rowH * 3.7);
      docInstance.text(record.address, valX, infoStartY + rowH * 4.7);
      docInstance.text(record.inspector, valX, infoStartY + rowH * 5.7);
      docInstance.text(record.advisor, valX, infoStartY + rowH * 6.7);

      docInstance.setFontSize(6);
      docInstance.text(`Página ${pageNum}`, pageWidth - 20, docInstance.internal.pageSize.getHeight() - 10);
    };

    // Prepare table data chunks of 30 rows
    const chunks: any[][] = [];
    const fullItems = record.items.map((item, index) => [
      index + 1,
      item.product,
      item.serialNumber,
      item.isMedicinal ? 'X' : '',
      item.isIndustrial ? 'X' : '',
      item.location
    ]);

    for (let i = 0; i < fullItems.length; i += 30) {
      const chunk = fullItems.slice(i, i + 30);
      // Pad with empty rows to always have 30
      while (chunk.length < 30) {
        chunk.push(['', '', '', '', '', '']);
      }
      chunks.push(chunk);
    }

    // If no items, still show one empty page
    if (chunks.length === 0) {
      const emptyChunk = Array(30).fill(['', '', '', '', '', '']).map((r, i) => [i + 1, '', '', '', '', '']);
      chunks.push(emptyChunk);
    }

    chunks.forEach((chunk, index) => {
      if (index > 0) doc.addPage();
      
      const tableStartY = 78;
      drawHeader(doc, index + 1);

      autoTable(doc, {
        startY: tableStartY,
        head: [['Nº', 'PRODUCTO', 'NÚMERO DE SERIE', 'MED.', 'IND.', 'UBICACIÓN']],
        body: chunk,
        theme: 'grid',
        headStyles: { 
          fillColor: [240, 240, 240], 
          textColor: lindeBlue[0], 
          fontSize: 7, 
          fontStyle: 'bold',
          halign: 'center'
        },
        styles: { 
          fontSize: 7, 
          cellPadding: 0.8, 
          lineColor: [180, 180, 180], 
          lineWidth: 0.1,
          minCellHeight: 5
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 7 },
          1: { cellWidth: 48 },
          2: { cellWidth: 50 },
          3: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
          4: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
          5: { cellWidth: 48 },
        },
        margin: { top: 78, bottom: 45 }, // Increased bottom margin to fit signatures
      });

      // Render Signatures on EVERY page
      const pageHeight = doc.internal.pageSize.getHeight();
      renderSignatures(doc, pageHeight - 35);
    });

    function renderSignatures(docInstance: jsPDF, y: number) {
      docInstance.setFontSize(7);
      docInstance.setTextColor(40);
      docInstance.setDrawColor(100);
      docInstance.setLineWidth(0.2);
      
      docInstance.line(10, y + 15, 65, y + 15);
      docInstance.text('Asesor Comercial', 37.5, y + 20, { align: 'center' });
      
      docInstance.line(75, y + 15, 130, y + 15);
      docInstance.text('Inspector de Cilindros', 102.5, y + 20, { align: 'center' });

      docInstance.line(140, y + 15, 195, y + 15);
      docInstance.text('Cliente', 167.5, y + 20, { align: 'center' });

      docInstance.setFontSize(6);
      docInstance.setTextColor(150);
      docInstance.text('LINDE BOLIVIA S.R.L.', 10, docInstance.internal.pageSize.getHeight() - 5);
    }

    doc.save(`Inventario_${record.customerName || 'Sin_Nombre'}_${record.date}.pdf`);
  };

  const clearInventory = () => {
    if (confirm("¿Estás seguro de que quieres borrar todo el inventario?")) {
      setRecord({
        ...record,
        items: INITIAL_ITEMS,
        timeEnd: '',
      });
      localStorage.removeItem('cylinder_inventory_draft');
    }
  };

  const finishSurvey = () => {
    setRecord(prev => ({ ...prev, timeEnd: format(new Date(), 'HH:mm') }));
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1D1D1B] font-sans selection:bg-[#E2E8F0]">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-[#1D1D1B]/5 px-4 md:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative group cursor-pointer flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleLogoUpload}
            />
            {logo ? (
              <img src={logo} alt="Logo" className="w-16 h-10 object-contain rounded-sm" />
            ) : (
              <div className="w-12 h-12 bg-[#006BA6] flex items-center justify-center rounded-sm group-hover:bg-[#005a8e] transition-all">
                <FileText className="text-white w-7 h-7" />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus size={10} />
            </div>
          </div>
          <div className="overflow-hidden">
            <h1 className="text-lg md:text-xl font-bold tracking-tight truncate">Cylinder Survey</h1>
            <p className="text-[9px] md:text-[10px] uppercase tracking-widest opacity-50 font-medium">Relevamiento Digital</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button 
            onClick={clearInventory}
            className="p-2.5 hover:bg-red-50 text-red-500 rounded-full transition-colors flex-shrink-0"
            title="Borrar todo"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={finishSurvey}
            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-3 md:px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/10 flex-grow sm:flex-grow-0"
          >
            <Clock size={16} />
            <span className="hidden xs:inline">Finalizar</span>
          </button>
          <button 
            onClick={exportPDF}
            className="flex items-center justify-center gap-2 bg-[#1D1D1B] text-white px-3 md:px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-[#333] transition-all shadow-lg shadow-black/10 flex-grow sm:flex-grow-0"
          >
            <Download size={16} />
            <span className="hidden xs:inline">PDF</span>
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Header Form Section */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white p-8 border border-[#1D1D1B]/10 rounded-sm shadow-sm">
          <div className="space-y-4 md:col-span-3">
            <div className="flex items-center gap-2 border-b border-[#1D1D1B]/10 pb-2 mb-4">
              <Building2 size={16} className="opacity-40" />
              <h2 className="text-xs uppercase tracking-[0.2em] font-bold opacity-60">Datos Generales</h2>
            </div>
          </div>

          <FormField label="Sucursal" icon={<Building2 size={16} />}>
            <input 
              type="text" 
              value={record.branch} 
              onChange={(e) => handleInputChange('branch', e.target.value)}
              placeholder="Nombre de sucursal"
              className="w-full bg-transparent outline-none py-1 border-b border-transparent focus:border-[#1D1D1B] transition-all"
            />
          </FormField>

          <FormField label="Fecha Inventario" icon={<CalendarIcon size={16} />}>
            <input 
              type="date" 
              value={record.date} 
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full bg-transparent outline-none py-1"
            />
          </FormField>

          <FormField label="Cód. Cliente" icon={<Search size={16} />}>
            <input 
              type="text" 
              value={record.customerCode} 
              onChange={(e) => handleInputChange('customerCode', e.target.value)}
              placeholder="000XXX"
              className="w-full bg-transparent outline-none py-1 border-b border-transparent focus:border-[#1D1D1B] transition-all"
            />
          </FormField>

          <FormField label="Cliente" icon={<User size={16} />}>
            <input 
              type="text" 
              value={record.customerName} 
              onChange={(e) => handleInputChange('customerName', e.target.value)}
              placeholder="Nombre completo"
              className="w-full bg-transparent outline-none py-1 border-b border-transparent focus:border-[#1D1D1B] transition-all font-medium"
            />
          </FormField>

          <FormField label="Domicilio" icon={<MapPin size={16} />}>
            <input 
              type="text" 
              value={record.address} 
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Dirección del cliente"
              className="w-full bg-transparent outline-none py-1 border-b border-transparent focus:border-[#1D1D1B] transition-all"
            />
          </FormField>

          <FormField label="Inspector" icon={<User size={16} />}>
            <input 
              type="text" 
              value={record.inspector} 
              onChange={(e) => handleInputChange('inspector', e.target.value)}
              placeholder="Nombre inspector"
              className="w-full bg-transparent outline-none py-1 border-b border-transparent focus:border-[#1D1D1B] transition-all"
            />
          </FormField>

          <FormField label="Asesor Comercial" icon={<User size={16} />}>
            <input 
              type="text" 
              value={record.advisor} 
              onChange={(e) => handleInputChange('advisor', e.target.value)}
              placeholder="Nombre asesor"
              className="w-full bg-transparent outline-none py-1 border-b border-transparent focus:border-[#1D1D1B] transition-all"
            />
          </FormField>

          <FormField label="Hora Inicio" icon={<Clock size={16} />}>
            <input 
              type="time" 
              value={record.timeStart} 
              onChange={(e) => handleInputChange('timeStart', e.target.value)}
              className="w-full bg-transparent outline-none py-1"
            />
          </FormField>

          <FormField label="Hora Final" icon={<Clock size={16} />}>
            <input 
              type="time" 
              value={record.timeEnd} 
              onChange={(e) => handleInputChange('timeEnd', e.target.value)}
              className="w-full bg-transparent outline-none py-1"
            />
          </FormField>
        </section>

        {/* Dynamic Table Section */}
        <section className="bg-white border border-[#1D1D1B]/10 rounded-sm shadow-sm overflow-hidden">
          <div className="p-6 border-b border-[#1D1D1B]/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#FAFAFA]">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#1D1D1B]/5 flex items-center justify-center font-bold text-xs text-[#1D1D1B]">
                  {record.items.length}
                </div>
                <h2 className="text-sm font-bold tracking-tight">Cilindros</h2>
              </div>
              
              <div className="relative flex-grow md:flex-grow-0 group">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:opacity-100 group-focus-within:text-[#006BA6] transition-all" />
                <input 
                  type="text"
                  placeholder="Buscar serial, producto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-full text-xs outline-none focus:border-[#006BA6] focus:ring-2 focus:ring-[#006BA6]/10 transition-all w-full md:w-56"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-30 hover:opacity-100 p-1"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <button 
                onClick={() => setAllItemsType('medicinal')}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 hover:bg-blue-100 transition-all flex items-center gap-1.5"
              >
                <Check size={12} /> Todo Medicinal
              </button>
              <button 
                onClick={() => setAllItemsType('industrial')}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 text-[10px] font-bold border border-orange-100 hover:bg-orange-100 transition-all flex items-center gap-1.5"
              >
                <Check size={12} /> Todo Industrial
              </button>
              <div className="w-px h-6 bg-gray-200 mx-1 hidden md:block"></div>
              <button 
                onClick={addItem}
                className="whitespace-nowrap flex items-center gap-2 text-[10px] font-bold bg-[#1D1D1B] text-white px-4 py-2 rounded-full border border-black hover:bg-black transition-all ml-auto md:ml-0"
              >
                <Plus size={14} />
                <span>Agregar</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead className="bg-[#1D1D1B] text-white text-[10px] uppercase tracking-widest font-bold">
                <Reorder.Group axis="x" values={columnOrder} onReorder={setColumnOrder} as="tr">
                  {columnOrder.map(col => (
                    <Reorder.Item key={col} value={col} as="th" className="cursor-grab active:cursor-grabbing px-6 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <GripHorizontal size={12} className="opacity-30" />
                          <span>
                            {col === 'n' && 'Nº'}
                            {col === 'product' && 'Producto'}
                            {col === 'serial' && 'Número de Serie'}
                            {col === 'type' && 'Tipo'}
                            {col === 'location' && 'Ubicación'}
                          </span>
                        </div>
                        {col !== 'n' && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSort(col);
                            }}
                            className={cn(
                              "p-1 hover:bg-white/10 rounded transition-colors",
                              sortConfig.key === col ? "text-[#006BA6]" : "text-white/30"
                            )}
                          >
                            <ArrowUpDown size={12} />
                          </button>
                        )}
                      </div>
                    </Reorder.Item>
                  ))}
                  <th className="px-6 py-4 w-12"></th>
                </Reorder.Group>
              </thead>
              <Reorder.Group axis="y" values={record.items} onReorder={reorderRows} as="tbody" className="divide-y divide-[#1D1D1B]/5">
                <AnimatePresence mode="popLayout">
                  {getSortedItems().map((item, index) => (
                    <Reorder.Item 
                      key={item.id}
                      value={item}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      as="tr"
                      className="group hover:bg-[#F9F9F9] transition-colors relative"
                    >
                      {columnOrder.map(col => (
                        <td key={col} className="px-6 py-4">
                          {col === 'n' && (
                            <div className="flex items-center gap-3">
                              <GripHorizontal size={14} className="opacity-0 group-hover:opacity-20 cursor-ns-resize transition-all shrink-0" />
                              <span className="text-xs font-mono opacity-50">{index + 1}</span>
                            </div>
                          )}
                          {col === 'product' && (
                            <input 
                              type="text" 
                              value={item.product}
                              onChange={(e) => handleItemChange(item.id, 'product', e.target.value)}
                              placeholder="Ej: Oxigeno Gas"
                              className="w-full bg-transparent outline-none text-sm placeholder:opacity-30 border-b border-transparent focus:border-[#1D1D1B]/20 py-1"
                            />
                          )}
                          {col === 'serial' && (
                            <div className="relative flex items-center gap-1">
                              <input 
                                type="text" 
                                value={item.serialNumber}
                                onChange={(e) => handleItemChange(item.id, 'serialNumber', e.target.value)}
                                placeholder="Escribe o captura..."
                                className={cn(
                                  "w-full bg-transparent outline-none text-sm font-mono placeholder:opacity-30 border-b border-transparent focus:border-[#1D1D1B]/20 py-1 transition-all",
                                  loadingRow === item.id ? "opacity-30 animate-pulse" : ""
                                )}
                              />
                              <div className="flex items-center">
                                <button 
                                  onClick={() => handleGeminiTrigger(item.id, false)}
                                  className="p-1.5 text-[#006BA6]/60 hover:text-[#006BA6] transition-all"
                                  title="Subir de galería"
                                  disabled={loadingRow !== null}
                                >
                                  <Upload size={16} />
                                </button>
                                <button 
                                  onClick={() => handleGeminiTrigger(item.id, true)}
                                  className="p-1.5 text-emerald-600/60 hover:text-emerald-600 transition-all"
                                  title="Tomar Foto"
                                  disabled={loadingRow !== null}
                                >
                                  <Camera size={16} />
                                </button>
                                <button 
                                  onClick={() => startScanning(item.id)}
                                  className="p-1.5 text-[#1D1D1B]/40 hover:text-[#1D1D1B] transition-all"
                                  title="Escanear Código de Barras"
                                  disabled={loadingRow !== null}
                                >
                                  <Barcode size={16} />
                                </button>
                              </div>
                            </div>
                          )}
                          {col === 'type' && (
                            <div className="flex justify-center gap-4">
                              <label className="flex items-center gap-2 cursor-pointer group/toggle">
                                <div className="relative">
                                  <input 
                                    type="checkbox"
                                    checked={item.isMedicinal}
                                    onChange={(e) => {
                                      handleItemChange(item.id, 'isMedicinal', e.target.checked);
                                      if (e.target.checked) handleItemChange(item.id, 'isIndustrial', false);
                                    }}
                                    className="sr-only"
                                  />
                                  <div className={cn(
                                    "w-10 h-10 border-2 rounded-sm flex items-center justify-center transition-all",
                                    item.isMedicinal ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-200" : "border-[#1D1D1B]/10 hover:border-[#1D1D1B]/30"
                                  )}>
                                    {item.isMedicinal && <Check className="text-white" size={20} />}
                                    {!item.isMedicinal && <span className="text-[10px] font-bold opacity-30 group-hover/toggle:opacity-60">M</span>}
                                  </div>
                                </div>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer group/toggle">
                                <div className="relative">
                                  <input 
                                    type="checkbox"
                                    checked={item.isIndustrial}
                                    onChange={(e) => {
                                      handleItemChange(item.id, 'isIndustrial', e.target.checked);
                                      if (e.target.checked) handleItemChange(item.id, 'isMedicinal', false);
                                    }}
                                    className="sr-only"
                                  />
                                  <div className={cn(
                                    "w-10 h-10 border-2 rounded-sm flex items-center justify-center transition-all",
                                    item.isIndustrial ? "bg-orange-600 border-orange-600 shadow-lg shadow-orange-200" : "border-[#1D1D1B]/10 hover:border-[#1D1D1B]/30"
                                  )}>
                                    {item.isIndustrial && <Check className="text-white" size={20} />}
                                    {!item.isIndustrial && <span className="text-[10px] font-bold opacity-30 group-hover/toggle:opacity-60">I</span>}
                                  </div>
                                </div>
                              </label>
                            </div>
                          )}
                          {col === 'location' && (
                            <div className="relative">
                              <input 
                                type="text" 
                                list="location-options"
                                value={item.location}
                                onChange={(e) => handleItemChange(item.id, 'location', e.target.value)}
                                placeholder="Ubicación"
                                className="w-full bg-transparent outline-none text-sm placeholder:opacity-30 border-b border-transparent focus:border-[#1D1D1B]/20 py-1"
                              />
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => removeItem(item.id)}
                          className={cn(
                            "p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all",
                            record.items.length === 1 && "opacity-0 pointer-events-none"
                          )}
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </Reorder.Item>
                  ))}
                </AnimatePresence>
              </Reorder.Group>
            </table>
          </div>

          <datalist id="location-options">
            {LOCATION_OPTIONS.map(opt => <option key={opt} value={opt} />)}
          </datalist>
          
          <div className="p-8 bg-[#F9F9F9] flex justify-center">
             <button 
              onClick={addItem}
              className="group flex flex-col items-center gap-3 text-[#1D1D1B]/40 hover:text-[#1D1D1B] transition-all"
            >
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#1D1D1B]/20 flex items-center justify-center group-hover:border-[#1D1D1B]/40 group-hover:bg-white transition-all">
                <Plus size={24} />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">Nuevo Cilindro</span>
            </button>
          </div>
        </section>

        {/* Signatures Preview (Visual only) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8 py-10 px-8 border-t border-[#1D1D1B]/10 opacity-30 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
          <div className="text-center space-y-4">
            <div className="h-20 flex items-end justify-center">
              <div className="w-40 border-b-2 border-black/20 pb-1 italic font-serif">Firma Comercial</div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest">Asesor Comercial</p>
          </div>
          <div className="text-center space-y-4">
            <div className="h-20 flex items-end justify-center">
              <div className="w-40 border-b-2 border-black/20 pb-1 italic font-serif">Firma Inspector</div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest">Inspector de Cilindros</p>
          </div>
          <div className="text-center space-y-4">
            <div className="h-20 flex items-end justify-center">
              <div className="w-40 border-b-2 border-black/20 pb-1 italic font-serif">Firma Cliente</div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest">Recibido Cliente</p>
          </div>
        </section>
      </main>

      {/* Hidden file input for Gemini Extraction */}
      <input 
        type="file"
        ref={geminiFileInputRef}
        className="hidden"
        accept="image/*"
        onChange={handleGeminiUpload}
      />

      {/* Scanner Modal Overlay */}
      <AnimatePresence>
        {activeScanner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-bold">Escanear Código de Barras</h3>
                <button onClick={stopScanning} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div id="barcode-reader" className="w-full aspect-square bg-black"></div>
              <div className="p-6 text-center text-xs text-gray-500 bg-gray-50">
                Apunta la cámara al número de serie del cilindro.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-12 px-6 border-t border-[#1D1D1B]/5 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-30">Cylinder Survey Pro © 2026</p>
      </footer>
    </div>
  );
}

function FormField({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 p-3 rounded-md bg-[#FAFAFA] border border-transparent hover:border-[#1D1D1B]/5 transition-all">
      <div className="flex items-center gap-2 mb-1">
        <div className="opacity-40">{icon}</div>
        <label className="text-[10px] font-extrabold uppercase tracking-widest opacity-60">{label}</label>
      </div>
      <div className="text-sm">
        {children}
      </div>
    </div>
  );
}
