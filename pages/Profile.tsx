
import React, { useState, useCallback, useRef } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import Cropper from 'react-easy-crop';
import { storage, db } from '../firebase';
import { useAuth } from '../App';
import { UserCircle, Camera, Check, Trash2, RefreshCw, X, Scissors, Monitor } from 'lucide-react';
import { getGreeting, getCroppedImg } from '../utils/helpers';

const Profile: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Cropper State
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  // Camera State
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Please select an image under 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImageToCrop(reader.result as string);
    });
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { aspectRatio: 1 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert("Could not access camera. Please check permissions.");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        const size = Math.min(videoRef.current.videoWidth, videoRef.current.videoHeight);
        canvasRef.current.width = size;
        canvasRef.current.height = size;
        context.drawImage(
          videoRef.current,
          (videoRef.current.videoWidth - size) / 2,
          (videoRef.current.videoHeight - size) / 2,
          size,
          size,
          0,
          0,
          size,
          size
        );
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setImageToCrop(dataUrl);
        stopCamera();
      }
    }
  };

  const handleApplyCrop = async () => {
    if (!imageToCrop || !croppedAreaPixels || !profile) return;

    setUploading(true);
    setImageToCrop(null);
    try {
      const croppedBlob = await getCroppedImg(imageToCrop, croppedAreaPixels);
      const storageRef = ref(storage, `profiles/${profile.uid}`);
      
      await uploadBytes(storageRef, croppedBlob);
      const url = await getDownloadURL(storageRef);
      
      await updateDoc(doc(db, 'users', profile.uid), {
        photoURL: url
      });
      
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error(error);
      alert("Failed to process image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile?.photoURL || !window.confirm("Remove your profile picture?")) return;

    setUploading(true);
    try {
      const storageRef = ref(storage, `profiles/${profile.uid}`);
      try {
        await deleteObject(storageRef);
      } catch (e) {
        console.warn("File might not exist in storage.");
      }

      await updateDoc(doc(db, 'users', profile.uid), {
        photoURL: null
      });

      await refreshProfile();
      alert("Profile picture removed.");
    } catch (error) {
      alert("Failed to remove photo.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Identity Management</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium">Manage your personal brand and account security.</p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] border dark:border-gray-800 shadow-2xl overflow-hidden">
        <div className="h-40 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 relative">
          <div className="absolute inset-0 bg-black/10"></div>
        </div>
        <div className="px-10 pb-10">
          <div className="relative -mt-20 mb-8 flex items-end gap-8">
            <div className="relative group">
              <div className="w-40 h-40 rounded-[2.5rem] border-8 border-white dark:border-gray-900 shadow-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center transition-transform group-hover:scale-[1.02]">
                {profile?.photoURL ? (
                  <img src={profile.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle className="w-28 h-28 text-gray-200 dark:text-gray-700" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center backdrop-blur-sm">
                    <RefreshCw className="text-white animate-spin mb-2" size={32} />
                    <span className="text-[10px] text-white font-black uppercase tracking-widest">Processing</span>
                  </div>
                )}
              </div>
              
              <div className="absolute -bottom-2 -right-2 flex flex-col gap-2">
                <label className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl cursor-pointer hover:bg-blue-500 transition-all border-4 border-white dark:border-gray-900 active:scale-90 group/btn">
                  <Camera size={20} />
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={uploading} />
                  <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-[10px] font-bold rounded opacity-0 group-hover/btn:opacity-100 whitespace-nowrap transition-opacity">Upload File</span>
                </label>
                <button 
                  onClick={startCamera}
                  disabled={uploading}
                  className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl hover:bg-indigo-500 transition-all border-4 border-white dark:border-gray-900 active:scale-90 group/cam"
                >
                  <Monitor size={20} />
                  <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-[10px] font-bold rounded opacity-0 group-hover/cam:opacity-100 whitespace-nowrap transition-opacity">Live Camera</span>
                </button>
              </div>
            </div>
            
            <div className="flex-1 pb-4">
               <h2 className="text-2xl font-black text-gray-900 dark:text-white">{profile?.name}</h2>
               <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">{profile?.role}</p>
               
               {profile?.photoURL && !uploading && (
                 <button 
                  onClick={handleRemovePhoto}
                  className="mt-4 text-[10px] font-black text-red-500 hover:text-red-600 flex items-center gap-1.5 uppercase tracking-widest bg-red-50 dark:bg-red-900/20 px-3 py-1.5 rounded-xl transition-all hover:bg-red-100"
                >
                  <Trash2 size={12} /> Remove Picture
                 </button>
               )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-gray-50 dark:bg-gray-800/50 p-8 rounded-3xl border dark:border-gray-800 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16"></div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <Check className="text-blue-600" size={24} /> Account Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <DetailItem label="Full Legal Name" value={profile?.name || 'N/A'} />
                <DetailItem label="Primary Email" value={profile?.email || 'N/A'} />
                <DetailItem label="Access Role" value={profile?.role || 'N/A'} />
                <DetailItem label="Status" value="Active Account" />
              </div>
            </div>

            {success && (
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-900/20 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-800 animate-in fade-in slide-in-from-top-2 text-sm uppercase tracking-widest">
                <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                   <Check size={20} />
                </div>
                Identity verified and updated!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Camera Capture Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                <Camera className="text-indigo-600" /> Take Snapshot
              </h3>
              <button onClick={stopCamera} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500 hover:text-red-500 transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="relative bg-black aspect-square flex items-center justify-center overflow-hidden">
              <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover scale-x-[-1]" />
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none flex items-center justify-center">
                <div className="w-full h-full border-2 border-white/50 rounded-full"></div>
              </div>
            </div>
            <div className="p-8 bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-4">
              <button
                onClick={capturePhoto}
                className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg shadow-xl hover:bg-indigo-500 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
              >
                <div className="w-4 h-4 rounded-full bg-white animate-ping"></div>
                Capture Now
              </button>
              <canvas ref={canvasRef} className="hidden" />
              <p className="text-[10px] text-gray-400 text-center font-bold uppercase tracking-widest">Ensure your face is centered and well-lit</p>
            </div>
          </div>
        </div>
      )}

      {/* Cropping Modal */}
      {imageToCrop && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
          <div className="bg-white dark:bg-gray-900 rounded-[3rem] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border dark:border-gray-800">
            <div className="px-8 py-6 border-b dark:border-gray-800 flex items-center justify-between">
              <h3 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2 uppercase tracking-tighter">
                <Scissors className="text-blue-600" size={24} /> Perfect the Frame
              </h3>
              <button onClick={() => setImageToCrop(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors text-gray-400">
                <X size={28} />
              </button>
            </div>
            
            <div className="relative flex-1 bg-gray-950 min-h-[400px]">
              <Cropper
                image={imageToCrop}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>

            <div className="p-10 bg-white dark:bg-gray-900 space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <span>Zoom Level</span>
                  <span className="text-blue-600">{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setImageToCrop(null)}
                  className="flex-1 py-4 px-6 border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={handleApplyCrop}
                  className="flex-1 py-4 px-6 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-500 shadow-2xl shadow-blue-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-blue-50/50 dark:bg-blue-900/10 p-8 rounded-3xl border-2 border-dashed border-blue-200 dark:border-blue-900/30">
        <h4 className="font-black text-blue-900 dark:text-blue-400 mb-2 uppercase text-xs tracking-widest">Security Advisory</h4>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">Account identity and role mappings are governed by the primary system administrator. To request a role upgrade or email change, please open a ticket with <span className="font-black text-blue-600">Admin JOSINE</span>.</p>
      </div>
    </div>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest block">{label}</label>
    <p className="text-md font-bold text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 px-4 py-3 rounded-2xl border dark:border-gray-700 shadow-sm">{value}</p>
  </div>
);

export default Profile;
