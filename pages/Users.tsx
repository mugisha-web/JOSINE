
import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, setDoc, doc, deleteDoc, updateDoc, serverTimestamp, orderBy } from 'firebase/firestore';
// Fix: Standard modular SDK imports for Auth and App
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Cropper from 'react-easy-crop';
import { db, auth as mainAuth, storage } from '../firebase';
import { UserProfile, UserRole } from '../types';
import { Plus, UserPlus, X, UserCircle, ShieldCheck, Trash2, Mail, Edit2, Save, Fingerprint, RefreshCw, Camera, Scissors } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import { getCroppedImg } from '../utils/helpers';

// Secondary config for creating users without signing out admin
const secondaryFirebaseConfig = {
  apiKey: "AIzaSyDywwVldj9q7Lu4N1NzyiB5Wywla8LcAYk",
  authDomain: "igihozo.firebaseapp.com",
  projectId: "igihozo",
  storageBucket: "igihozo.firebasestorage.app",
  messagingSenderId: "482765886496",
  appId: "1:482765886496:web:399b83da03ca85e8ec9845",
};

const Users: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({ uid: '', name: '', email: '', password: '', role: UserRole.SELLER, photoURL: '' });
  const [formLoading, setFormLoading] = useState(false);

  // Cropping State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [tempPhotoBlob, setTempPhotoBlob] = useState<Blob | null>(null);
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(items);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => setImageToCrop(reader.result as string));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const applyCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels) return;
    try {
      const blob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setTempPhotoBlob(blob);
      setTempPhotoUrl(URL.createObjectURL(blob));
      setImageToCrop(null);
    } catch (e) {
      alert("Cropping failed.");
    }
  };

  const openAddModal = () => {
    setIsEditMode(false);
    setFormData({ uid: '', name: '', email: '', password: '', role: UserRole.SELLER, photoURL: '' });
    setTempPhotoBlob(null);
    setTempPhotoUrl(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserProfile) => {
    setIsEditMode(true);
    setFormData({ uid: user.uid, name: user.name, email: user.email, password: '', role: user.role, photoURL: user.photoURL || '' });
    setTempPhotoBlob(null);
    setTempPhotoUrl(user.photoURL || null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    let secondaryApp = null;
    
    try {
      if (isEditMode) {
        let finalPhotoURL = formData.photoURL;
        
        // If a new photo was cropped, upload it
        if (tempPhotoBlob) {
          const sRef = ref(storage, `profiles/${formData.uid}`);
          await uploadBytes(sRef, tempPhotoBlob);
          finalPhotoURL = await getDownloadURL(sRef);
        }

        await updateDoc(doc(db, 'users', formData.uid), {
          name: formData.name,
          role: formData.role,
          photoURL: finalPhotoURL
        });
        alert("Staff profile updated.");
      } else {
        const secondaryAppName = `SecondaryApp_${Date.now()}`;
        // modular initializeApp usage
        secondaryApp = initializeApp(secondaryFirebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
        const newUser = userCredential.user;

        let finalPhotoURL = '';
        if (tempPhotoBlob) {
          const sRef = ref(storage, `profiles/${newUser.uid}`);
          await uploadBytes(sRef, tempPhotoBlob);
          finalPhotoURL = await getDownloadURL(sRef);
        }
        
        const userProfile: UserProfile = {
          uid: newUser.uid,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          photoURL: finalPhotoURL,
          createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'users', newUser.uid), userProfile);
        await signOut(secondaryAuth);
        // modular deleteApp
        await deleteApp(secondaryApp);
        secondaryApp = null;
        
        alert(`Account for ${formData.name} created.`);
      }

      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      alert("Error: " + (error.code || error.message));
      if (secondaryApp) try { await deleteApp(secondaryApp); } catch(e) {}
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (uid === "BA6oNMbz5EdkPMMwG35nDSz253U2") return alert("System admin protected.");
    if (!window.confirm(`Delete user "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      setUsers(users.filter(u => u.uid !== uid));
    } catch (error) {
      alert("Delete failed.");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2rem] shadow-xl text-white">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Staff Directory</h1>
          <p className="text-blue-100 opacity-80 mt-1 font-medium">Control access levels and manage team profiles.</p>
        </div>
        <button
          onClick={openAddModal}
          className="bg-white text-blue-700 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-blue-50 shadow-lg active:scale-95 transition-all w-full md:w-auto justify-center"
        >
          <UserPlus size={20} />
          Add New Employee
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users.map(user => (
          <div key={user.uid} className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 flex items-start gap-4 hover:shadow-xl hover:-translate-y-1 transition-all relative group overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden border dark:border-gray-700 shrink-0">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <UserCircle className="text-gray-300 dark:text-gray-600" size={40} />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-gray-900 dark:text-white truncate text-lg">{user.name}</h4>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-4 font-medium truncate">
                <Mail size={12} className="text-blue-500" />
                {user.email}
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${
                user.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {user.role}
              </div>
            </div>

            <div className="absolute top-4 right-4 flex gap-1">
              <button onClick={() => openEditModal(user)} className="p-2 text-gray-400 hover:text-blue-600 rounded-xl transition-all">
                <Edit2 size={18} />
              </button>
              {user.uid !== "BA6oNMbz5EdkPMMwG35nDSz253U2" && (
                <button onClick={() => handleDeleteUser(user.uid, user.name)} className="p-2 text-gray-400 hover:text-red-600 rounded-xl transition-all">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-md shadow-2xl border dark:border-gray-800 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-8 py-6 border-b dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-2xl font-black text-gray-900 dark:text-white">{isEditMode ? 'Update Staff' : 'New Employee'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:text-gray-900">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-5 overflow-y-auto">
              <div className="flex flex-col items-center gap-4 mb-4">
                 <div className="relative w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center">
                    {tempPhotoUrl ? (
                       <img src={tempPhotoUrl} className="w-full h-full object-cover" alt="Preview" />
                    ) : (
                       <UserCircle className="text-gray-300" size={48} />
                    )}
                    <label className="absolute bottom-1 right-1 p-1.5 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-500 transition-all shadow-lg">
                       <Camera size={14} />
                       <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                 </div>
                 <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Set Profile Picture</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Legal Name</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-5 py-3 border dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {!isEditMode && (
                <>
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Email</label>
                    <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full px-5 py-3 border dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Password</label>
                    <input type="password" required value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className="w-full px-5 py-3 border dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-gray-400">Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {[UserRole.SELLER, UserRole.ADMIN].map(r => (
                    <button key={r} type="button" onClick={() => setFormData({ ...formData, role: r })} className={`py-3 rounded-2xl font-black text-xs uppercase border transition-all ${formData.role === r ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-transparent border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={formLoading} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                {formLoading ? <RefreshCw className="animate-spin" /> : <><Save size={20} /> {isEditMode ? 'Update Registry' : 'Grant Access'}</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Cropping Flow */}
      {imageToCrop && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-white dark:bg-gray-900 rounded-[3rem] w-full max-w-xl overflow-hidden flex flex-col border dark:border-gray-800">
            <div className="px-8 py-6 border-b dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2"><Scissors size={20} className="text-blue-600" /> Frame Profile</h3>
              <button onClick={() => setImageToCrop(null)} className="text-gray-400 hover:text-red-500"><X size={28} /></button>
            </div>
            <div className="relative h-[400px] bg-black">
              <Cropper image={imageToCrop} crop={crop} zoom={zoom} aspect={1} cropShape="round" onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
            </div>
            <div className="p-10 space-y-6">
              <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              <div className="flex gap-4">
                <button onClick={() => setImageToCrop(null)} className="flex-1 py-4 border-2 rounded-2xl font-black text-xs uppercase tracking-widest text-gray-500">Discard</button>
                <button onClick={applyCrop} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest">Crop & Select</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
