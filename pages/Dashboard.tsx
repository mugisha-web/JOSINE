
import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Product, Sale, UserRole } from '../types';
import { getGreeting, formatCurrency, formatDate } from '../utils/helpers';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  DollarSign,
  ArrowRight,
  Trash2,
  Zap,
  LayoutGrid
} from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalStock: 0,
    lowStockCount: 0,
    dailySales: 0,
    totalSales: 0
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const productsSnap = await getDocs(collection(db, 'products'));
      const products = productsSnap.docs.map(d => d.data() as Product);
      const lowStock = products.filter(p => p.stock < 10).length;
      const totalProducts = products.length;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const salesQuery = query(
        collection(db, 'sales'),
        where('createdAt', '>=', today),
        orderBy('createdAt', 'desc')
      );
      const dailySalesSnap = await getDocs(salesQuery);
      const dSales = dailySalesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale);
      const dailyTotal = dSales.reduce((sum, s) => sum + s.totalPrice, 0);

      const allSalesSnap = await getDocs(collection(db, 'sales'));
      const allTotal = allSalesSnap.docs.reduce((sum, d) => sum + (d.data().totalPrice || 0), 0);

      setStats({
        totalStock: totalProducts,
        lowStockCount: lowStock,
        dailySales: dailyTotal,
        totalSales: allTotal
      });

      setRecentSales(dSales.slice(0, 5));
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDeleteRecentSale = async (id: string) => {
    if (!window.confirm("Admin Action: Void this transaction permanently?")) return;
    try {
      await deleteDoc(doc(db, 'sales', id));
      setRecentSales(recentSales.filter(s => s.id !== id));
      fetchDashboardData();
    } catch (error) {
      alert("System Error: Could not delete record.");
    }
  };

  if (loading) return <LoadingSpinner />;

  const isAdmin = profile?.role === UserRole.ADMIN;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tight">{getGreeting(profile?.name || 'User')}</h1>
            <p className="text-blue-100 font-medium opacity-90 flex items-center gap-2">
              <Zap size={16} className="text-yellow-400 fill-yellow-400" /> 
              The system is live and tracking sales in real-time.
            </p>
          </div>
          <button 
            onClick={() => navigate('/sales')}
            className="bg-white text-blue-700 px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:bg-blue-50 transition-all active:scale-95 flex items-center gap-2"
          >
            New Transaction <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Daily Revenue" 
          value={formatCurrency(stats.dailySales)} 
          icon={<TrendingUp className="text-emerald-600" />} 
          bgColor="bg-emerald-50 dark:bg-emerald-900/20"
          subText="Updated just now"
        />
        <StatCard 
          title="Inventory Size" 
          value={`${stats.totalStock} SKUs`} 
          icon={<Package className="text-blue-600" />} 
          bgColor="bg-blue-50 dark:bg-blue-900/20"
          subText="Total catalog"
        />
        <StatCard 
          title="Stock Alerts" 
          value={`${stats.lowStockCount} items`} 
          icon={<AlertTriangle className="text-orange-500" />} 
          bgColor="bg-orange-50 dark:bg-orange-900/20"
          highlight={stats.lowStockCount > 0}
          subText="Below threshold"
        />
        <StatCard 
          title="Lifetime Rev" 
          value={formatCurrency(stats.totalSales)} 
          icon={<DollarSign className="text-indigo-600" />} 
          bgColor="bg-indigo-50 dark:bg-indigo-900/20"
          subText="All time volume"
        />
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] shadow-sm border dark:border-gray-800 overflow-hidden">
        <div className="px-8 py-6 border-b dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-xl">
              <LayoutGrid size={20} className="text-blue-600" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">Recent Activity</h3>
          </div>
          <button 
            onClick={() => navigate('/reports')}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-black text-xs uppercase tracking-widest flex items-center gap-1 group"
          >
            History <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-[10px] uppercase text-gray-400 font-black tracking-widest">
              <tr>
                <th className="px-8 py-5">Product Name</th>
                <th className="px-8 py-5">Qty</th>
                <th className="px-8 py-5">Value</th>
                <th className="px-8 py-5">Method</th>
                <th className="px-8 py-5">Timestamp</th>
                {isAdmin && <th className="px-8 py-5 text-right">Admin</th>}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-800 text-sm">
              {recentSales.length > 0 ? (
                recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-8 py-5 font-bold text-gray-900 dark:text-gray-100">{sale.productName}</td>
                    <td className="px-8 py-5 dark:text-gray-300 font-medium">{sale.quantity}</td>
                    <td className="px-8 py-5 font-black text-gray-900 dark:text-gray-100">{formatCurrency(sale.totalPrice)}</td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-widest uppercase ${
                        sale.paymentMethod === 'MOMO' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-gray-400 font-medium">{formatDate(sale.createdAt).split(',')[1]}</td>
                    {isAdmin && (
                      <td className="px-8 py-5 text-right">
                        <button 
                          onClick={() => handleDeleteRecentSale(sale.id)}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-8 py-16 text-center text-gray-500 italic">No transactions processed today.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Fix: Change subTextText to subText to match usage and destructuring
const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  bgColor: string;
  highlight?: boolean;
  subText?: string;
}> = ({ title, value, icon, bgColor, highlight, subText }) => (
  <div className={`p-8 rounded-[2rem] border bg-white dark:bg-gray-900 shadow-sm transition-all hover:shadow-xl hover:-translate-y-1 ${highlight ? 'border-orange-500 ring-2 ring-orange-100 dark:ring-orange-900/30' : 'border-gray-100 dark:border-gray-800'}`}>
    <div className={`w-14 h-14 rounded-2xl ${bgColor} flex items-center justify-center mb-6 shadow-inner`}>
      {icon}
    </div>
    <p className="text-gray-400 dark:text-gray-500 text-[10px] font-black uppercase tracking-widest mb-1">{title}</p>
    <h4 className="text-3xl font-black text-gray-900 dark:text-white">{value}</h4>
    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase">{subText}</p>
  </div>
);

export default Dashboard;
