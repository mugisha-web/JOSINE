
import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, getDoc, deleteDoc, serverTimestamp, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { Product, Sale, PaymentMethod, UserRole } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';
import { ShoppingCart, CheckCircle, AlertCircle, FileText, Trash2 } from 'lucide-react';
import { generateSalesReport } from '../services/pdfService';
import LoadingSpinner from '../components/LoadingSpinner';

const Sales: React.FC = () => {
  const { profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [saleLoading, setSaleLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Products
      const pSnap = await getDocs(query(collection(db, 'products'), where('stock', '>', 0)));
      setProducts(pSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Product));

      // Today's Sales
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const sQuery = query(
        collection(db, 'sales'),
        where('createdAt', '>=', today),
        orderBy('createdAt', 'desc')
      );
      const sSnap = await getDocs(sQuery);
      setTodaySales(sSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Sale));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !profile) return;
    setSaleLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const productRef = doc(db, 'products', selectedProductId);
      const productSnap = await getDoc(productRef);
      
      if (!productSnap.exists()) throw new Error("Product not found.");
      
      const product = productSnap.data() as Product;
      if (product.stock < quantity) {
        throw new Error(`Insufficient stock. Available: ${product.stock}`);
      }

      const total = product.price * quantity;

      // 1. Save Sale
      const saleData: Omit<Sale, 'id'> = {
        productId: selectedProductId,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        totalPrice: total,
        paymentMethod,
        sellerId: profile.uid,
        sellerName: profile.name,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, 'sales'), saleData);

      // 2. Reduce Stock
      await updateDoc(productRef, {
        stock: product.stock - quantity,
        updatedAt: serverTimestamp()
      });

      setSuccessMsg(`Sale successful! Total: ${formatCurrency(total)}`);
      setQuantity(1);
      setSelectedProductId('');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSaleLoading(false);
    }
  };

  const handleDeleteSale = async (id: string) => {
    if (!window.confirm("Admin: Are you sure you want to delete this sales record? Note: This will not automatically revert the product stock.")) return;
    try {
      await deleteDoc(doc(db, 'sales', id));
      setTodaySales(todaySales.filter(s => s.id !== id));
      alert("Sales record deleted.");
    } catch (error) {
      alert("Failed to delete.");
    }
  };

  const downloadTodayReport = () => {
    if (profile) {
      generateSalesReport(
        todaySales, 
        profile, 
        "Today's Sales Report", 
        formatDate(new Date()).split(',')[0]
      );
    }
  };

  if (loading) return <LoadingSpinner />;

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const isAdmin = profile?.role === UserRole.ADMIN;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Sales Form */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border dark:border-gray-800 shadow-sm">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2 dark:text-white">
            <ShoppingCart className="text-blue-600" /> New Sale
          </h2>

          {successMsg && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 text-green-700 dark:text-green-400 flex items-center gap-2">
              <CheckCircle size={20} /> <span className="text-sm font-bold">{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertCircle size={20} /> <span className="text-sm font-bold">{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSale} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Select Product</label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-4 py-2 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} - ({p.stock} in stock)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Quantity</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full px-4 py-2 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1 dark:text-gray-300">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-4 py-2 border dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={PaymentMethod.CASH}>Cash</option>
                  <option value={PaymentMethod.MOMO}>Mobile Money</option>
                </select>
              </div>
            </div>

            {selectedProduct && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">Unit Price:</span>
                  <span className="font-bold dark:text-white">{formatCurrency(selectedProduct.price)}</span>
                </div>
                <div className="flex justify-between text-lg border-t border-blue-200 dark:border-blue-800 pt-2 mt-1">
                  <span className="font-bold text-blue-900 dark:text-blue-400">Total:</span>
                  <span className="font-extrabold text-blue-900 dark:text-blue-400">{formatCurrency(selectedProduct.price * quantity)}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={saleLoading || !selectedProductId}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transition-all ${
                saleLoading || !selectedProductId ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
              }`}
            >
              {saleLoading ? 'Processing...' : 'Complete Sale'}
            </button>
          </form>
        </div>
      </div>

      {/* History Table */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
            <h3 className="font-bold text-gray-900 dark:text-white">Today's Sales History</h3>
            <button 
              onClick={downloadTodayReport}
              className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 transition-all"
            >
              <FileText size={16} /> Export PDF
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 border-b dark:border-gray-800 text-xs text-gray-400 font-bold uppercase">
                <tr>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Product</th>
                  <th className="px-6 py-4">Qty</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Method</th>
                  {isAdmin && <th className="px-6 py-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {todaySales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400">{formatDate(sale.createdAt).split(',')[1]}</td>
                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{sale.productName}</td>
                    <td className="px-6 py-4 dark:text-gray-300">{sale.quantity}</td>
                    <td className="px-6 py-4 font-bold text-blue-900 dark:text-blue-400">{formatCurrency(sale.totalPrice)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        sale.paymentMethod === 'MOMO' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      }`}>
                        {sale.paymentMethod}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteSale(sale.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Void Sale"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {todaySales.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400 italic">No sales today. Start selling!</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sales;
