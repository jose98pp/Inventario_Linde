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
  Check
} from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

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
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Persistence to local storage (optional but helpful for refresh)
  useEffect(() => {
    const saved = localStorage.getItem('cylinder_inventory_draft');
    if (saved) {
      try {
        setRecord(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved draft", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cylinder_inventory_draft', JSON.stringify(record));
  }, [record]);

  const handleInputChange = (field: keyof InventoryRecord, value: string) => {
    setRecord(prev => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (id: string, field: keyof Cylinder, value: string | boolean) => {
    setRecord(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
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
        { fps: 10, qrbox: { width: 250, height: 150 } },
        false
      );

      scanner.render((decodedText) => {
        handleItemChange(activeScanner, 'serialNumber', decodedText);
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

  const exportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const lindeBlue = [0, 107, 166]; // RGB for Linde Blue
    
    // 1. Logo at Top Left
    // Since we don't have the image asset, we'll draw a stylized representation or leave space
    doc.setFillColor(lindeBlue[0], lindeBlue[1], lindeBlue[2]);
    doc.rect(10, 10, 30, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Linde', 15, 17);

    // 2. Center Title in Box
    doc.setDrawColor(180);
    doc.setLineWidth(0.3);
    doc.rect(45, 10, 100, 10);
    doc.setTextColor(lindeBlue[0], lindeBlue[1], lindeBlue[2]);
    doc.setFontSize(14);
    doc.text('INVENTARIO DE CILINDROS', 95, 17, { align: 'center' });

    // 3. Right Status Box
    const rightBoxX = 150;
    doc.setDrawColor(150);
    doc.rect(rightBoxX, 10, 50, 24); // Container for right boxes
    
    doc.setTextColor(40);
    doc.setFontSize(8);
    // Grid inside right box
    doc.line(rightBoxX, 18, 200, 18);
    doc.line(rightBoxX, 26, 200, 26);
    
    doc.text('Total cilindros:', rightBoxX + 2, 15);
    doc.text(record.items.length.toString(), rightBoxX + 35, 15);
    
    doc.text('Hora Inicio:', rightBoxX + 2, 23);
    doc.text(record.timeStart, rightBoxX + 35, 23);
    
    doc.text('Hora Final:', rightBoxX + 2, 31);
    doc.text(record.timeEnd || '', rightBoxX + 35, 31);

    // 4. Main Info Grid (Matches the paper format)
    const infoStartY = 40;
    const infoHeight = 45;
    doc.rect(10, infoStartY, 130, infoHeight);
    
    const rowHeight = infoHeight / 7;
    for (let i = 1; i < 7; i++) {
      doc.line(10, infoStartY + (i * rowHeight), 140, infoStartY + (i * rowHeight));
    }
    
    const labelX = 12;
    const valueX = 45;
    
    doc.setFont('helvetica', 'bold');
    doc.text('Fecha Inventario:', labelX, infoStartY + rowHeight * 0.7);
    doc.text('Sucursal:', labelX, infoStartY + rowHeight * 1.7);
    doc.text('Código de cliente:', labelX, infoStartY + rowHeight * 2.7);
    doc.text('Cliente:', labelX, infoStartY + rowHeight * 3.7);
    doc.text('Domicilio:', labelX, infoStartY + rowHeight * 4.7);
    doc.text('Inspector:', labelX, infoStartY + rowHeight * 5.7);
    doc.text('Asesor Comercial:', labelX, infoStartY + rowHeight * 6.7);
    
    doc.setFont('helvetica', 'normal');
    doc.text(record.date, valueX, infoStartY + rowHeight * 0.7);
    doc.text(record.branch, valueX, infoStartY + rowHeight * 1.7);
    doc.text(record.customerCode, valueX, infoStartY + rowHeight * 2.7);
    doc.text(record.customerName, valueX, infoStartY + rowHeight * 3.7);
    doc.text(record.address, valueX, infoStartY + rowHeight * 4.7);
    doc.text(record.inspector, valueX, infoStartY + rowHeight * 5.7);
    doc.text(record.advisor, valueX, infoStartY + rowHeight * 6.7);

    // 5. Main Table
    const tableData = record.items.map((item, index) => [
      index + 1,
      item.product,
      item.serialNumber,
      item.isMedicinal ? 'X' : '',
      item.isIndustrial ? 'X' : '',
      item.location
    ]);

    // Fill to 30 rows if needed to match the paper exactly
    while (tableData.length < 30) {
      tableData.push(['', '', '', '', '', '']);
    }

    autoTable(doc, {
      startY: infoStartY + infoHeight + 5,
      head: [['Nº', 'PRODUCTO', 'NÚMERO DE SERIE', 'MEDICINAL', 'INDUSTRIAL', 'UBICACIÓN']],
      body: tableData,
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
        cellPadding: 1, 
        lineColor: [180, 180, 180], 
        lineWidth: 0.1 
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 7 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { halign: 'center', cellWidth: 15 },
        4: { halign: 'center', cellWidth: 15 },
        5: { cellWidth: 50 },
      },
      margin: { left: 10, right: 10 }
    });

    // 6. Signatures
    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setDrawColor(100);
    doc.line(10, finalY, 65, finalY);
    doc.text('Asesor Comercial', 37.5, finalY + 5, { align: 'center' });
    
    doc.line(75, finalY, 130, finalY);
    doc.text('Inspector de Cilindros', 102.5, finalY + 5, { align: 'center' });

    doc.line(140, finalY, 195, finalY);
    doc.text('Cliente', 167.5, finalY + 5, { align: 'center' });

    // Footer branding
    doc.setFontSize(6);
    doc.setTextColor(150);
    doc.text('LINDE BOLIVIA S.R.L.', 10, doc.internal.pageSize.getHeight() - 5);

    doc.save(`Inventario_${record.customerName || 'SinNombre'}_${record.date}.pdf`);
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
      <nav className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-bottom border-[#1D1D1B]/5 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1D1D1B] flex items-center justify-center rounded-sm">
            <FileText className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Inventario de Cilindros</h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 font-medium">Relevamiento Digital</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={clearInventory}
            className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors"
            title="Borrar todo"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={finishSurvey}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-900/10"
            title="Marcar hora de finalización"
          >
            <Clock size={18} />
            <span>Finalizar</span>
          </button>
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 bg-[#1D1D1B] text-white px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-[#333] transition-all shadow-lg shadow-black/10"
          >
            <Download size={18} />
            <span>Exportar PDF</span>
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
          <div className="p-6 border-b border-[#1D1D1B]/10 flex justify-between items-center bg-[#FAFAFA]">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#1D1D1B]/5 flex items-center justify-center font-bold text-xs">
                {record.items.length}
              </div>
              <h2 className="text-sm font-bold tracking-tight">Cilindros Relevados</h2>
            </div>
            <button 
              onClick={addItem}
              className="flex items-center gap-2 text-xs font-bold bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full border border-emerald-200 hover:bg-emerald-100 transition-all"
            >
              <Plus size={14} />
              <span>Agregar Cilindro</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#1D1D1B] text-white text-[10px] uppercase tracking-widest font-bold">
                <tr>
                  <th className="px-6 py-4 w-12">Nº</th>
                  <th className="px-6 py-4 min-w-[180px]">Producto</th>
                  <th className="px-6 py-4 min-w-[200px]">Número de Serie</th>
                  <th className="px-6 py-4 text-center">Tipo</th>
                  <th className="px-6 py-4">Ubicación</th>
                  <th className="px-6 py-4 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D1D1B]/5">
                <AnimatePresence>
                  {record.items.map((item, index) => (
                    <motion.tr 
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="group hover:bg-[#F9F9F9] transition-colors"
                    >
                      <td className="px-6 py-4 text-xs font-mono opacity-50">{index + 1}</td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={item.product}
                          onChange={(e) => handleItemChange(item.id, 'product', e.target.value)}
                          placeholder="Ej: Oxigeno Gas"
                          className="w-full bg-transparent outline-none text-sm placeholder:opacity-30 border-b border-transparent focus:border-[#1D1D1B]/20 py-1"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative flex items-center">
                          <input 
                            type="text" 
                            value={item.serialNumber}
                            onChange={(e) => handleItemChange(item.id, 'serialNumber', e.target.value)}
                            placeholder="Escanea o escribe..."
                            className="w-full bg-transparent outline-none text-sm font-mono placeholder:opacity-30 border-b border-transparent focus:border-[#1D1D1B]/20 py-1 pr-10"
                          />
                          <button 
                            onClick={() => startScanning(item.id)}
                            className="absolute right-0 p-2 text-[#1D1D1B]/40 hover:text-[#1D1D1B] transition-colors"
                            title="Escanear Código"
                          >
                            <Barcode size={18} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
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
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={item.location}
                          onChange={(e) => handleItemChange(item.id, 'location', e.target.value)}
                          placeholder="Ubicación"
                          className="w-full bg-transparent outline-none text-sm placeholder:opacity-30 border-b border-transparent focus:border-[#1D1D1B]/20 py-1"
                        />
                      </td>
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
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
          
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
