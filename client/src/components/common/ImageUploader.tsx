import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

interface ImageUploaderProps {
  label?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved?: () => void;
  currentImage?: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label = 'Add Photo',
  onImageUploaded,
  onImageRemoved,
  currentImage
}) => {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Photo size exceeds 10MB limit.');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const res = await api.uploadFile(file);
      if (res.url) {
        setPreview(res.url);
        onImageUploaded(res.url);
      }
    } catch (err: any) {
      setError(err.message || 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (onImageRemoved) onImageRemoved();
  };

  return (
    <div className="w-full">
      {label && <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">{label}</label>}

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-40 flex items-center justify-center group">
          <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full shadow transition-all"
            title="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-brand-500 hover:bg-brand-50/40 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all min-h-[110px]"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center text-brand-600">
              <Loader2 className="w-6 h-6 animate-spin mb-1.5" />
              <span className="text-xs font-medium">Uploading photo...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-2">
                <Camera className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold text-slate-700">Take a photo or upload</span>
              <span className="text-[11px] text-slate-400 mt-0.5">JPEG, PNG, WEBP up to 10MB</span>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-600 mt-1.5">{error}</p>}
    </div>
  );
};
