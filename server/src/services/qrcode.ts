import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { CONFIG } from '../config';

/**
 * Auto-detect the host machine's primary LAN IPv4 address for physical phone scanning
 */
export function getLanIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('127.')) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

export class QRCodeService {
  /**
   * Generates a cryptographic secure room token
   */
  static generateSecureToken(): string {
    return uuidv4().replace(/-/g, '').substring(0, 16);
  }

  /**
   * Gets the public guest URL for a token.
   * If baseUrl contains localhost, automatically uses the detected LAN IP so phones can open the link.
   */
  static getGuestUrl(token: string, customBaseUrl?: string): string {
    let base = customBaseUrl || CONFIG.BASE_URL;
    if (base.includes('localhost') || base.includes('127.0.0.1')) {
      const lan = getLanIp();
      if (lan && lan !== 'localhost') {
        base = base.replace(/localhost|127\.0\.0\.1/, lan);
      }
    }
    return `${base.replace(/\/$/, '')}/guest/r/${token}`;
  }

  /**
   * Generates a base64 Data URL (PNG)
   */
  static async generateDataUrl(token: string, customBaseUrl?: string): Promise<string> {
    const url = this.getGuestUrl(token, customBaseUrl);
    return await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 400,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  }

  /**
   * Generates SVG string
   */
  static async generateSvg(token: string, customBaseUrl?: string): Promise<string> {
    const url = this.getGuestUrl(token, customBaseUrl);
    return await QRCode.toString(url, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  }
}
