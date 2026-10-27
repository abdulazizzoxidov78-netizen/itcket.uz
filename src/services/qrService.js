const QRCode = require('qrcode');

/**
 * Generate a PNG Buffer of QR Code
 */
async function generateQRBuffer(data, options = {}) {
  try {
    const opts = {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 1,
      width: options.width || 250,
      color: {
        dark: '#111827',
        light: '#FFFFFF',
      },
      ...options,
    };
    return await QRCode.toBuffer(data, opts);
  } catch (err) {
    console.error('QR Buffer generation failed:', err);
    throw err;
  }
}

/**
 * Generate Data URL (base64 string) of QR Code
 */
async function generateQRDataURL(data, options = {}) {
  try {
    const opts = {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: options.width || 250,
      color: {
        dark: '#111827',
        light: '#FFFFFF',
      },
      ...options,
    };
    return await QRCode.toDataURL(data, opts);
  } catch (err) {
    console.error('QR DataURL generation failed:', err);
    throw err;
  }
}

module.exports = {
  generateQRBuffer,
  generateQRDataURL,
};
