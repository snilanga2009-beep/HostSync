import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

export interface BrandingInfo {
  productName: string;
  subtitle: string;
  hotelName: string;
  resortName: string;
  logoUrl?: string;
  currency: string;
  phone?: string;
  emergencyPhone?: string;
  loading: boolean;
  refreshBranding: () => Promise<void>;
  updateBranding: (updates: Partial<BrandingInfo>) => void;
}

const defaultBranding: BrandingInfo = {
  productName: 'ResortCare',
  subtitle: 'Smart Guest Service & Room Maintenance Platform',
  hotelName: 'Ocean Pearl Resort & Spa',
  resortName: 'Ocean Pearl Resort',
  logoUrl: '',
  currency: 'USD',
  phone: '+1 (305) 555-0100',
  emergencyPhone: '911',
  loading: false,
  refreshBranding: async () => {},
  updateBranding: () => {}
};

const BrandingContext = createContext<BrandingInfo>(defaultBranding);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [productName, setProductName] = useState('ResortCare');
  const [subtitle, setSubtitle] = useState('Smart Guest Service & Room Maintenance Platform');
  const [hotelName, setHotelName] = useState('Ocean Pearl Resort & Spa');
  const [resortName, setResortName] = useState('Ocean Pearl Resort');
  const [logoUrl, setLogoUrl] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [phone, setPhone] = useState('+1 (305) 555-0100');
  const [emergencyPhone, setEmergencyPhone] = useState('911');
  const [loading, setLoading] = useState(true);

  const fetchBranding = async () => {
    try {
      const res = await api.get<{ settings: any }>('/settings');
      const identity = res.settings?.branding?.identity;
      if (identity) {
        if (identity.productName) setProductName(identity.productName);
        if (identity.subtitle) setSubtitle(identity.subtitle);
        if (identity.hotelName) setHotelName(identity.hotelName);
        if (identity.resortName) setResortName(identity.resortName);
        if (identity.logoUrl !== undefined) setLogoUrl(identity.logoUrl);
        if (identity.currency) setCurrency(identity.currency);
        if (identity.contactPhone) setPhone(identity.contactPhone);
        if (identity.emergencyPhone) setEmergencyPhone(identity.emergencyPhone);
      }
    } catch (err) {
      // Fallback to defaults
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranding();
  }, []);

  const updateBranding = (updates: Partial<BrandingInfo>) => {
    if (updates.productName !== undefined) setProductName(updates.productName);
    if (updates.subtitle !== undefined) setSubtitle(updates.subtitle);
    if (updates.hotelName !== undefined) setHotelName(updates.hotelName);
    if (updates.resortName !== undefined) setResortName(updates.resortName);
    if (updates.logoUrl !== undefined) setLogoUrl(updates.logoUrl);
    if (updates.currency !== undefined) setCurrency(updates.currency);
    if (updates.phone !== undefined) setPhone(updates.phone);
    if (updates.emergencyPhone !== undefined) setEmergencyPhone(updates.emergencyPhone);
  };

  return (
    <BrandingContext.Provider
      value={{
        productName,
        subtitle,
        hotelName,
        resortName,
        logoUrl,
        currency,
        phone,
        emergencyPhone,
        loading,
        refreshBranding: fetchBranding,
        updateBranding
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = () => useContext(BrandingContext);
