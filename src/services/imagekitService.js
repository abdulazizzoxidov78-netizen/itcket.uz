const ImageKit = require('imagekit');
const config = require('../config');
const logger = require('../utils/logger');

let imagekit = null;
if (config.imagekit.publicKey && config.imagekit.privateKey && config.imagekit.urlEndpoint) {
  try {
    imagekit = new ImageKit({
      publicKey: config.imagekit.publicKey,
      privateKey: config.imagekit.privateKey,
      urlEndpoint: config.imagekit.urlEndpoint,
    });
  } catch (e) {
    logger.warn('ImageKit initializatsiyasida xatolik, lokal fallback ishlatiladi.');
  }
}

async function uploadImage(fileBuffer, fileName) {
  if (!imagekit) {
    logger.info('ImageKit sozlanmagan, placeholder rasm ishlatiladi.');
    return 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1200';
  }

  try {
    const response = await imagekit.upload({
      file: fileBuffer.toString('base64'),
      fileName: fileName || `event_${Date.now()}.jpg`,
      folder: config.imagekit.folder || '/tickets',
    });
    return response.url;
  } catch (err) {
    logger.error('ImageKit yuklashda xatolik:', err);
    throw err;
  }
}

module.exports = {
  uploadImage,
};
