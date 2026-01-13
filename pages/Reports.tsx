
import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, orderBy, doc, deleteDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Sale, UserRole, ReportArchive } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { FileDown, Trash2, AlertCircle, RefreshCw, Archive, History, CheckCircle2, Eraser } from 'lucide-react';
import { generateSalesReport } from '../services/pdfService';
import LoadingSpinner from '../components/LoadingSpinner';

const Reports: React.FC = () => {
  const { profile } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [archives, setArchives] = useState<ReportArchive[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivesLoading, setArchivesLoading] = useState(false);
  const [filter, setFilter] = useState('today'); // today, week, month, all
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const fetchSales = async (type: string) => {
    setLoading(true);
    try {
      let q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
      
      if (type !== 'all') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        if (type === 'week') start.setDate(start.getDate() - 7);
        if (type === 'month') start.setMonth(start.getMonth() - 1);
        
        q = query(
          collection(db, 'sales'),
          where('createdAt', '>=', start),
          orderBy('createdAt', 'desc')
        );
      }

      const snap = await getDocs(q);
      setSales(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchArchives = async () => {
    setArchivesLoading(true);
    try {
      const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setArchives(snap.docs.map(d => ({ id: d.id, ...d.data() }) as ReportArchive));
    } catch (error) {
      console.error(error);
    } finally {
      setArchivesLoading(false);
    }
  };

  useEffect(() => {
    fetchSales(filter);
  }, [filter]);

  useEffect(() => {
    fetchArchives();
  }, []);

  const handleDeleteSale = async (id: string) => {
    if (!window.confirm("Admin: Are you sure you want to delete this specific sales record?")) return;
    try {
      await deleteDoc(doc(db, 'sales', id));
      setSales(sales.filter(s => s.id !== id));
    } catch (error) {
      alert("Error deleting record.");
    }
  };

  const handleDeleteAllFiltered = async () => {
    if (sales.length === 0) return;
    const confirm1 = window.confirm(`DANGER: You are about to delete ALL ${sales.length} records in the current "${filter}" view. This cannot be undone! Proceed?`);
    if (!confirm1) return;
    
    const confirm2 = window.confirm("FINAL WARNING: Are you absolutely sure? Make sure you have exported or archived this report first.");
    if (!confirm2) return;

    setIsDeletingAll(true);
    try {
      const batch = writeBatch(db);
      sales.forEach((sale) => {
        batch.delete(doc(db, 'sales', sale.id));
      });
      await batch.commit();
      setSales([]);
      alert("All filtered records have been deleted.");
    } catch (error) {
      console.error(error);
      alert("Failed to delete some records.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDeleteArchive = async (id: string) => {
    if (!window.confirm("Admin: Are you sure you want to delete this archived report entry?")) return;
    try {
      await deleteDoc(doc(db, 'reports', id));
      setArchives(archives.filter(a => a.id !== id));
    } catch (error) {
      alert("Error deleting archive.");
    }
  };

  const handleArchiveReport = async () => {
    if (sales.length === 0 || !profile) return;
    
    setIsArchiving(true);
    try {
      const total = sales.reduce((a, b) => a + (b.totalPrice || 0), 0);
      const newReport: Omit<ReportArchive, 'id'> = {
        title: `Sales Report - ${filter.toUpperCase()}`,
        period: filter,
        totalSales: total,
        transactionCount: sales.length,
        generatedBy: profile.name,
        generatedById: profile.uid,
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'reports'), newReport);
      alert("Report summary archived to history.");
      fetchArchives();
    } catch (error) {
      alert("Failed to archive report.");
    } finally {
      setIsArchiving(false);
    }
  };

  const stats = {
    total: sales.reduce((a, b) => a + (b.totalPrice || 0), 0),
    count: sales.length,
    cash: sales.filter(s => s.paymentMethod === 'CASH').reduce((a, b) => a + (b.totalPrice || 0), 0),
    momo: sales.filter(s => s.paymentMethod === 'MOMO').reduce((a, b) => a + (b.totalPrice || 0), 0),
  };

  const handleExport = () => {
    if (profile) {
      generateSalesReport(
        sales, 
        profile, 
        `Sales Report - ${filter.toUpperCase()}`, 
        filter === 'today' ? formatDate(new Date()).split(',')[0] : `Last ${filter}`
      );
    }
  };

  const isAdmin = profile?.role === UserRole.ADMIN;

  return (
    <div className="space-y-12 pb-20">
      {/* Sales Analytics Section */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Analysis</h1>
            <p className="text-gray-500 dark:text-gray-400">Review real-time transaction data and manage records.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-gray-900 border dark:border-gray-800 rounded-xl outline-none font-semibold text-sm shadow-sm dark:text-gray-100"
            >
              <option value="today">Today</option>
              <option value="week">Past 7 Days</option>
              <option value="month">Past 30 Days</option>
              <option value="all">All Time</option>
            </select>
            
            <button
              onClick={handleArchiveReport}
              disabled={isArchiving || sales.length === 0}
              className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
              title="Save a summary snapshot"
            >
              {isArchiving ? <RefreshCw size={18} className="animate-spin" /> : <Archive size={18} />}
              Archive
            </button>

            <button
              onClick={handleExport}
              disabled={sales.length === 0}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              <FileDown size={20} /> Export PDF
            </button>

            {isAdmin && (
              <button
                onClick={handleDeleteAllFiltered}
                disabled={isDeletingAll || sales.length === 0}
                className="flex items-center gap-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl font-bold hover:bg-red-200 dark:hover:bg-red-900/40 transition-all disabled:opacity-50"
                title="Delete all records currently filtered"
              >
                {isDeletingAll ? <RefreshCw size={18} className="animate-spin" /> : <Eraser size={18} />}
                Clear Report Data
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Volume" value={formatCurrency(stats.total)} subValue={`${stats.count} Sales`} color="blue" />
          <StatCard title="Transactions" value={stats.count.toString()} subValue="Records found" color="gray" />
          <StatCard title="Cash Revenue" value={formatCurrency(stats.cash)} subValue="Direct Payments" color="indigo" />
          <StatCard title="MoMo Revenue" value={formatCurrency(stats.momo)} subValue="Digital Payments" color="yellow" />
        </div>

        {loading ? <LoadingSpinner /> : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-800 text-xs text-gray-400 font-bold uppercase">
                  <tr>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Qty</th>
                    <th className="px-6 py-4">Total</th>
                    <th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4">Seller</th>
                    {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-800">
                  {sales.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{formatDate(s.createdAt)}</td>
                      <td className="px-6 py-4 font-bold text-gray-900 dark:text-gray-100">{s.productName}</td>
                      <td className="px-6 py-4 font-medium dark:text-gray-200">{s.quantity}</td>
                      <td className="px-6 py-4 font-bold text-blue-900 dark:text-blue-400">{formatCurrency(s.totalPrice)}</td>
                      <td className="px-6 py-4">
                         <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.paymentMethod === 'MOMO' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        }`}>
                          {s.paymentMethod}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400 italic text-xs">{s.sellerName}</td>
                      {isAdmin && (
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDeleteSale(s.id)}
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 italic">No sales found for this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Report Archive History Collection */}
      <section className="space-y-6 pt-8 border-t dark:border-gray-800">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
            <History size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Report Archive History</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">A permanent collection of saved report summaries.</p>
          </div>
        </div>

        {archivesLoading ? (
           <div className="h-32 flex items-center justify-center border-2 border-dashed dark:border-gray-800 rounded-2xl">
              <RefreshCw className="animate-spin text-gray-300" />
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {archives.map(report => (
              <div key={report.id} className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-gray-800 shadow-sm group hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded">Snapshot</span>
                    <h4 className="font-bold text-gray-900 dark:text-white">{report.title}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Archived on {formatDate(report.createdAt)}</p>
                  </div>
                  {isAdmin && (
                    <button 
                      onClick={() => handleDeleteArchive(report.id)}
                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-t dark:border-gray-800 pt-4 mt-4">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Total Sales</p>
                    <p className="font-extrabold text-blue-900 dark:text-blue-400">{formatCurrency(report.totalSales)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">Transactions</p>
                    <p className="font-extrabold text-gray-900 dark:text-gray-100">{report.transactionCount}</p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t dark:border-gray-800 flex items-center gap-2">
                   <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase">
                      {report.generatedBy.charAt(0)}
                   </div>
                   <p className="text-[10px] text-gray-500 dark:text-gray-400">Saved by <span className="font-bold">{report.generatedBy}</span></p>
                </div>
              </div>
            ))}
            {archives.length === 0 && (
              <div className="col-span-full py-12 text-center border-2 border-dashed dark:border-gray-800 rounded-2xl">
                <Archive className="mx-auto text-gray-300 dark:text-gray-700 mb-2" size={32} />
                <p className="text-gray-500 dark:text-gray-400 italic">No reports archived yet. Use the "Archive" button above to save snapshots.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

const StatCard = ({ title, value, subValue, color }: { title: string, value: string, subValue: string, color: string }) => {
  const colors: Record<string, string> = {
    blue: "text-blue-900 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10",
    gray: "text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-800/50",
    indigo: "text-indigo-900 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/10",
    yellow: "text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/10"
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-5 rounded-2xl border dark:border-gray-800 shadow-sm">
      <p className="text-gray-500 dark:text-gray-400 text-[10px] font-black uppercase tracking-widest mb-2">{title}</p>
      <div className="space-y-1">
        <p className={`text-xl font-black ${colors[color].split(' ')[0]}`}>{value}</p>
        <p className="text-xs text-gray-400 font-medium">{subValue}</p>
      </div>
    </div>
  );
};

export default Reports;
