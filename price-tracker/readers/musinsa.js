globalThis.PriceReaderSites ??= {};
globalThis.PriceReaderSites.musinsa = {
  label: '무신사',
  eventNames: ['무진장 블랙프라이데이','무진장','타임특가','타임세일','블랙프라이데이','브랜드위크'],
  eventSelectors: ['[data-testid*="promotion"]','[data-testid*="event"]','[data-testid*="badge"]','[class*="promotion"]','[class*="badge"]'],
  defaults: {},
  idKeys: ['goodsNo', 'goodsId', 'goodsNumber', 'productNo', 'productId'],
  nameKeys: ['goodsName', 'goodsNm', 'productName', 'productNm'],
  imageKeys: ['goodsImage', 'goodsImageUrl', 'goodsImg', 'imageUrl', 'thumbnailImageUrl'],
  originalKeys: ['normalPrice', 'originalPrice', 'regularPrice', 'listPrice', 'goodsPrice'],
  saleKeys: ['salePrice', 'sellingPrice', 'sellPrice', 'goodsSalePrice'],
  globals: ['__NEXT_DATA__', '__INITIAL_STATE__', '__PRELOADED_STATE__', '__NUXT__', '__APOLLO_STATE__', 'goodsInfo', 'goodsData', 'productInfo']
};
